import {
    asDefined,
    asInstanceOf,
    assert,
    EmptyExec,
    isUndefined,
    JSONValue,
    Option,
    panic,
    Provider,
    Subscription,
    Terminable,
    Terminator,
    UUID
} from "@opendaw/lib-std"
import {ArrayField, BoxGraph, Field, ObjectField, PointerField, PrimitiveField, Update} from "@opendaw/lib-box"
import {YMapper} from "./YMapper"
import * as Y from "yjs"

type EventHandler = (events: Array<Y.YEvent<any>>, transaction: Y.Transaction) => void

export type Construct<T> = {
    boxGraph: BoxGraph<T>,
    doc: Y.Doc
    conflict?: Provider<boolean>
}

export class YSync<T> implements Terminable {
    static isEmpty(doc: Y.Doc): boolean {
        return doc.getMap("boxes").size === 0
    }

    static async populate<T>({boxGraph, doc}: Construct<T>): Promise<YSync<T>> {
        console.debug("populate")
        const boxesMap = doc.getMap("boxes")
        assert(boxesMap.size === 0, "BoxesMap must be empty")
        const sync = new YSync<T>({boxGraph, doc})
        doc.transact(() => boxGraph.boxes().forEach(box => {
            const key = UUID.toString(box.address.uuid)
            const map = YMapper.createBoxMap(box)
            boxesMap.set(key, map)
        }), "[openDAW] populate")
        return sync
    }

    static async join<T>({boxGraph, doc}: Construct<T>): Promise<YSync<T>> {
        console.debug("join")
        assert(boxGraph.boxes().length === 0, "BoxGraph must be empty")
        const sync = new YSync<T>({boxGraph, doc})
        boxGraph.beginTransaction()
        const boxesMap: Y.Map<unknown> = doc.getMap("boxes")
        boxesMap.forEach((value, key) => {
            const boxMap = value as Y.Map<any>
            const uuid = UUID.parse(key)
            const name = boxMap.get("name") as keyof T
            const fields = boxMap.get("fields") as Y.Map<unknown>
            boxGraph.createBox(name, uuid, box => YMapper.applyFromBoxMap(box, fields))
        })
        boxGraph.endTransaction()
        boxGraph.verifyPointers()
        return sync
    }

    readonly #terminator = new Terminator()

    readonly #boxGraph: BoxGraph<T>
    readonly #doc: Y.Doc
    readonly #conflict: Option<Provider<boolean>>
    readonly #boxesMap: Y.Map<unknown>
    readonly #updates: Array<Update>

    #ignoreUpdates: boolean = false

    constructor({boxGraph, doc, conflict}: Construct<T>) {
        this.#boxGraph = boxGraph
        this.#doc = doc
        this.#conflict = Option.wrap(conflict)
        this.#boxesMap = doc.getMap("boxes")
        this.#updates = []
        this.#terminator.ownAll(this.#setupYjs(), this.#setupOpenDAW())
    }

    terminate(): void {this.#terminator.terminate()}

    #setupYjs(): Subscription {
        const eventHandler: EventHandler = (events, {origin, local}) => {
            const originLabel = typeof origin === "string" ? origin : "WebsocketProvider"
            console.debug(`got ${events.length} ${local ? "local" : "external"} updates from '${originLabel}'`)
            if (local) {return}
            console.debug("beginTransaction")
            this.#boxGraph.beginTransaction()
            for (const event of events) {
                const path = event.path
                const keys = event.changes.keys
                for (const [key, change] of keys.entries()) {
                    if (change.action === "add") {
                        assert(path.length === 0, "'Add' cannot have a path")
                        this.#createBox(key)
                    } else if (change.action === "update") {
                        if (path.length === 0) {return}
                        assert(path.length >= 2, "Invalid path: must have at least 2 elements (uuid, 'fields').")
                        this.#updateValue(path, key)
                    } else if (change.action === "delete") {
                        assert(path.length === 0, "'Delete' cannot have a path")
                        this.#deleteBox(key)
                    }
                }
            }
            this.#ignoreUpdates = true
            this.#boxGraph.endTransaction()
            this.#ignoreUpdates = false
            console.debug("endTransactionTransaction")
            try {
                this.#boxGraph.verifyPointers()
            } catch (reason) {
                this.terminate()
                return panic(reason)
            }
            const highLevelConflict = this.#conflict.mapOr(check => check(), false)
            if (highLevelConflict) {
                this.#rollbackTransaction(events)
            }
        }
        this.#boxesMap.observeDeep(eventHandler)
        return {terminate: () => {this.#boxesMap.unobserveDeep(eventHandler)}}
    }

    #createBox(key: string): void {
        const map = this.#boxesMap.get(key) as Y.Map<unknown>
        const name = map.get("name") as keyof T
        const fields = map.get("fields") as Y.Map<unknown>
        const uuid = UUID.parse(key)
        const optBox = this.#boxGraph.findBox(UUID.parse(key))
        if (optBox.isEmpty()) {
            this.#boxGraph.createBox(name, uuid, box => YMapper.applyFromBoxMap(box, fields))
        } else {
            console.debug(`Box '${key}' has already been created. Performing 'Upsert'.`)
            YMapper.applyFromBoxMap(optBox.unwrap(), fields)
        }
    }

    #updateValue(path: ReadonlyArray<string | number>, key: string): void {
        const vertexOption = this.#boxGraph.findVertex(YMapper.pathToAddress(path, key))
        if (vertexOption.isEmpty()) {
            console.debug(`Vertex at '${path}' does not exist. Ignoring.`)
            return
        }
        const vertex = vertexOption.unwrap("Could not find field")
        const [uuidAsString, fieldsKey, ...fieldKeys] = path
        const targetMap = YMapper.findMap((this.#boxesMap
            .get(String(uuidAsString)) as Y.Map<unknown>)
            .get(String(fieldsKey)) as Y.Map<unknown>, fieldKeys)
        assert(vertex.isField(), "Vertex must be either Primitive or Pointer")
        vertex.accept({
            visitField: (_: Field) => panic("Vertex must be either Primitive or Pointer"),
            visitArrayField: (_: ArrayField) => panic("Vertex must be either Primitive or Pointer"),
            visitObjectField: (_: ObjectField<any>) => panic("Vertex must be either Primitive or Pointer"),
            visitPointerField: (field: PointerField) => field.fromJSON(targetMap.get(key) as JSONValue),
            visitPrimitiveField: (field: PrimitiveField) => field.fromJSON(targetMap.get(key) as JSONValue)
        })
    }

    #deleteBox(key: string): void {
        const optBox = this.#boxGraph.findBox(UUID.parse(key))
        if (optBox.isEmpty()) {
            console.debug(`Box '${key}' has already been deleted. Ignoring.`)
        } else {
            const box = optBox.unwrap()
            // It is possible that Yjs have swallowed the pointer releases since they were 'inside' the box.
            box.outgoingEdges().forEach(([pointer]) => pointer.defer())
            box.incomingEdges().forEach(pointer => pointer.defer())
            this.#boxGraph.unstageBox(box)
        }
    }

    #rollbackTransaction(events: ReadonlyArray<Y.YEvent<any>>): void {
        console.debug(`rollback ${events.length} events...`)
        this.#doc.transact(() => {
            for (let i = events.length - 1; i >= 0; i--) {
                const event = events[i]
                const target = asInstanceOf(event.target, Y.Map)
                Array.from(event.changes.keys.entries())
                    .toReversed()
                    .forEach(([key, change]) => {
                        if (change.action === "add") {
                            target.delete(key)
                        } else if (change.action === "update") {
                            if (isUndefined(change.oldValue)) {
                                console.warn(`oldValue of ${change} is undefined`)
                                target.delete(key)
                            } else {
                                target.set(key, change.oldValue)
                            }
                        } else if (change.action === "delete") {
                            target.set(key, change.oldValue)
                        }
                    })
            }
        }, "[openDAW] rollback")
    }

    #setupOpenDAW(): Terminable {
        return Terminable.many(
            this.#boxGraph.subscribeTransaction({
                onBeginTransaction: EmptyExec,
                onEndTransaction: () => {
                    if (this.#ignoreUpdates) {
                        this.#updates.length = 0
                        return
                    }
                    this.#doc.transact(() => this.#updates.forEach(update => {
                        /**
                         * TRANSFER CHANGES FROM OPENDAW TO YJS
                         */
                        if (update.type === "new") {
                            const uuid = update.uuid
                            const key = UUID.toString(uuid)
                            const box = this.#boxGraph.findBox(uuid).unwrap()
                            this.#boxesMap.set(key, YMapper.createBoxMap(box))
                        } else if (update.type === "primitive") {
                            const key = UUID.toString(update.address.uuid)
                            const boxObject = asDefined(this.#boxesMap.get(key),
                                "Could not find box") as Y.Map<unknown>
                            const {address: {fieldKeys}, newValue} = update
                            let field = boxObject.get("fields") as Y.Map<unknown>
                            for (let i = 0; i < fieldKeys.length - 1; i++) {
                                field = asDefined(field.get(String(fieldKeys[i])),
                                    `No field at '${fieldKeys[i]}'`) as Y.Map<unknown>
                            }
                            field.set(String(fieldKeys[fieldKeys.length - 1]), newValue)
                        } else if (update.type === "pointer") {
                            const key = UUID.toString(update.address.uuid)
                            const boxObject = asDefined(this.#boxesMap.get(key),
                                "Could not find box") as Y.Map<unknown>
                            const {address: {fieldKeys}, newAddress} = update
                            let field = boxObject.get("fields") as Y.Map<unknown>
                            for (let i = 0; i < fieldKeys.length - 1; i++) {
                                field = asDefined(field.get(String(fieldKeys[i])),
                                    `No field at '${fieldKeys[i]}'`) as Y.Map<unknown>
                            }
                            field.set(String(fieldKeys[fieldKeys.length - 1]),
                                newAddress.mapOr(address => address.toString(), null))
                        } else if (update.type === "delete") {
                            this.#boxesMap.delete(UUID.toString(update.uuid))
                        }
                    }), "[openDAW] updates")
                    this.#updates.length = 0
                }
            }),
            this.#boxGraph.subscribeToAllUpdatesImmediate({
                onUpdate: (update: Update): unknown => this.#updates.push(update)
            })
        )
    }
}