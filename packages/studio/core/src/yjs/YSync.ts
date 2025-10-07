import {
    asDefined,
    assert,
    EmptyExec,
    isInstanceOf,
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
        }), "populate")
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
        const eventHandler: EventHandler = (events, transaction) => {
            console.debug("got updates", transaction.origin)
            if (transaction.local) {
                console.debug("Skip local update")
                return
            }
            this.#boxGraph.beginTransaction()
            events.forEach(event => {
                const path = event.path
                const keys = event.changes.keys
                keys.entries().forEach(([key, change]: [string, { action: "add" | "delete" | "update" }]) => {
                    if (change.action === "add") {
                        assert(path.length === 0, "'Add' cannot have a path")
                        const map = this.#boxesMap.get(key) as Y.Map<unknown>
                        const name = map.get("name") as keyof T
                        const fields = map.get("fields") as Y.Map<unknown>
                        const uuid = UUID.parse(key)
                        this.#boxGraph.createBox(name, uuid, box => YMapper.applyFromBoxMap(box, fields))
                    } else if (change.action === "update") {
                        if (path.length === 0) {return}
                        assert(path.length >= 2, "Invalid path: must have at least 2 elements (uuid, 'fields').")
                        this.#updateValue(path, key)
                    } else if (change.action === "delete") {
                        assert(path.length === 0, "'Delete' cannot have a path")
                        const box = this.#boxGraph.findBox(UUID.parse(key))
                            .unwrap("Could not find box to delete")
                        // It is possible that Yjs have swallowed the pointer updates since were are 'inside' the box.
                        box.outgoingEdges().forEach(([pointer]) => pointer.defer())
                        box.incomingEdges().forEach(pointer => pointer.defer())
                        this.#boxGraph.unstageBox(box)
                    }
                })
            })
            this.#ignoreUpdates = true
            this.#boxGraph.endTransaction()
            this.#boxGraph.verifyPointers()
            this.#ignoreUpdates = false

            const highLevelConflict = this.#conflict.mapOr(check => check(), false)
            if (highLevelConflict) {
                this.#rollbackTransaction(events)
            }
        }
        this.#boxesMap.observeDeep(eventHandler)
        return {terminate: () => {this.#boxesMap.unobserveDeep(eventHandler)}}
    }

    #updateValue(path: ReadonlyArray<string | number>, key: string): void {
        const [uuidAsString, fieldsKey, ...fieldKeys] = path
        const targetMap = YMapper.findMap((this.#boxesMap
            .get(String(uuidAsString)) as Y.Map<unknown>)
            .get(String(fieldsKey)) as Y.Map<unknown>, fieldKeys)
        const vertexOption = this.#boxGraph.findVertex(YMapper.pathToAddress(path, key))
        const vertex = vertexOption.unwrap("Could not find field")
        assert(vertex.isField(), "Vertex must be either Primitive or Pointer")
        vertex.accept({
            visitField: (_: Field) => panic("Vertex must be either Primitive or Pointer"),
            visitArrayField: (_: ArrayField) => panic("Vertex must be either Primitive or Pointer"),
            visitObjectField: (_: ObjectField<any>) => panic("Vertex must be either Primitive or Pointer"),
            visitPointerField: (field: PointerField) => field.fromJSON(targetMap.get(key) as JSONValue),
            visitPrimitiveField: (field: PrimitiveField) => field.fromJSON(targetMap.get(key) as JSONValue)
        })
    }

    #rollbackTransaction(events: ReadonlyArray<Y.YEvent<any>>): void {
        console.debug("rollbackTransaction", events.length)
        for (let i = events.length - 1; i >= 0; i--) {
            const event = events[i]
            const target = event.target
            if (!isInstanceOf(target, Y.Map)) {
                return panic("Only Y.Map events are supported")
            }
            Array.from(event.changes.keys.entries())
                .reverse()
                .forEach(([key, change]) => {
                    if (change.action === "add") {
                        target.delete(key)
                    } else if (change.action === "update") {
                        if (isUndefined(change.oldValue)) {
                            target.delete(key)
                        } else {
                            target.set(key, change.oldValue)
                        }
                    } else if (change.action === "delete") {
                        target.set(key, change.oldValue)
                    }
                })
        }
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
                         * TRANSFER CHANGES FROM OPENDAW TO LIVEBLOCKS
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
                    }), "openDAW")
                    this.#updates.length = 0
                }
            }),
            this.#boxGraph.subscribeToAllUpdatesImmediate({
                onUpdate: (update: Update): unknown => this.#updates.push(update)
            })
        )
    }
}