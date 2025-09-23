import {
    asDefined,
    assert,
    EmptyExec,
    Iterables,
    JSONValue,
    panic,
    Subscription,
    Terminable,
    Terminator,
    UUID
} from "@opendaw/lib-std"
import {ArrayField, BoxGraph, Field, ObjectField, PointerField, PrimitiveField, Update} from "@opendaw/lib-box"
import {Room} from "@liveblocks/client"
import {getYjsProviderForRoom} from "@liveblocks/yjs"
import * as Y from "yjs"
import {Utils} from "@/liveblocks/Utils"

const boxesMapKey = "y-boxes"

type EventHandler = (events: Array<Y.YEvent<any>>, transaction: Y.Transaction) => void

export class LiveblocksSync<T> implements Terminable {
    static populate<T>(boxGraph: BoxGraph<T>, room: Room): LiveblocksSync<T> {
        const provider = getYjsProviderForRoom(room)
        const doc: Y.Doc = provider.getYDoc()
        const boxesMap = doc.getMap(boxesMapKey)
        assert(boxesMap.size === 0, "boxesMap must be empty")
        const sync = new LiveblocksSync<T>(boxGraph, doc)
        doc.transact(() => boxGraph.boxes().forEach(box => {
            const key = UUID.toString(box.address.uuid)
            const map = Utils.createBoxMap(box)
            boxesMap.set(key, map)
        }), "populate")
        return sync
    }

    static async join<T>(boxGraph: BoxGraph<T>, room: Room): Promise<LiveblocksSync<T>> {
        assert(boxGraph.boxes().length === 0, "BoxGraph must be empty")
        const provider = getYjsProviderForRoom(room)
        const doc: Y.Doc = provider.getYDoc()
        await new Promise<void>((resolve) => {
            if (provider.synced) {
                resolve()
            } else {
                provider.on("synced", resolve)
            }
        })
        const sync = new LiveblocksSync<T>(boxGraph, doc)
        sync.#boxGraph.beginTransaction()
        const boxesMap: Y.Map<unknown> = doc.getMap(boxesMapKey)
        console.debug("boxesMap", boxesMap.size)
        boxesMap.forEach((value, key) => {
            const boxMap = value as Y.Map<any>
            const uuid = UUID.parse(key)
            const name = boxMap.get("name") as keyof T
            const fields = boxMap.get("fields") as Y.Map<unknown>
            boxGraph.createBox(name, uuid, box => Utils.applyFromBoxMap(box, fields))
        })
        sync.#boxGraph.endTransaction()
        sync.#boxGraph.verifyPointers()
        return sync
    }

    readonly #terminator = new Terminator()

    readonly #boxGraph: BoxGraph<T>
    readonly #doc: Y.Doc
    readonly #boxesMap: Y.Map<unknown>

    readonly #updates: Array<Update>

    #ignoreUpdates: boolean = false

    constructor(boxGraph: BoxGraph<T>, doc: Y.Doc) {
        this.#boxGraph = boxGraph
        this.#doc = doc
        this.#boxesMap = doc.getMap(boxesMapKey)
        this.#updates = []

        this.#terminator.ownAll(
            this.#boxGraph.subscribeTransaction({
                onBeginTransaction: EmptyExec,
                onEndTransaction: () => {
                    if (this.#ignoreUpdates) {
                        this.#updates.length = 0
                        return
                    }
                    this.#doc.transact(() => this.#updates.forEach(update => {
                        console.debug(update)
                        /**
                         * TRANSFER CHANGES FROM OPENDAW TO LIVEBLOCKS
                         */
                        if (update.type === "new") {
                            const uuid = update.uuid
                            const key = UUID.toString(uuid)
                            const box = this.#boxGraph.findBox(uuid).unwrap()
                            this.#boxesMap.set(key, Utils.createBoxMap(box))
                        } else if (update.type === "primitive") {
                            const key = UUID.toString(update.address.uuid)
                            const boxObject = asDefined(this.#boxesMap.get(key),
                                "Could not find box") as Y.Map<unknown>
                            const {address: {fieldKeys}, newValue} = update
                            console.debug("P", boxObject, fieldKeys, newValue)
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
                    }), "openDAW transaction")
                    this.#updates.length = 0
                }
            }),
            this.#boxGraph.subscribeToAllUpdatesImmediate({
                onUpdate: (update: Update): unknown => this.#updates.push(update)
            })
        )
        this.#setupYjsSubscription() // TODO How to terminate this?
    }

    terminate(): void {this.#terminator.terminate()}

    #setupYjsSubscription(): Subscription {
        const eventHandler: EventHandler = (events, transaction) => {
            console.debug("got updates", transaction.origin)
            if (transaction.local) { // TODO Push this up when done
                console.debug("Skip local update")
                return
            }
            this.#boxGraph.beginTransaction()
            events.forEach(event => {
                const path = event.path
                const keys = event.changes.keys
                keys.entries().forEach(([key, change]: [string, {
                    action: "add" | "delete" | "update",
                    oldValue: any
                }]) => {
                    console.debug(path, key, change)
                    if (change.action === "add") {
                        assert(path.length === 0, "Add cannot have a path")
                        const boxMap = this.#boxesMap.get(key) as Y.Map<unknown>
                        const name = boxMap.get("name") as keyof T
                        const fields = boxMap.get("fields") as Y.Map<unknown>
                        const uuid = UUID.parse(key)
                        this.#boxGraph.createBox(name, uuid, box => Utils.applyFromBoxMap(box, fields))
                    } else if (change.action === "update") {
                        if (path.length === 0) {return}
                        this.#updateValue(path, key)
                    } else if (change.action === "delete") {
                        assert(path.length === 0, "Delete cannot have a path")
                        console.debug("delete", key)
                        const remove = this.#boxGraph.findBox(UUID.parse(key)).unwrap("Could not find box to delete")
                        const {pointers} = this.#boxGraph.dependenciesOf(remove)
                        console.debug("pointers", Iterables.count(pointers))
                        for (const pointer of pointers) {pointer.defer()}
                        this.#boxGraph.unstageBox(remove)
                    }
                })
            })
            console.debug("All updates applied")
            this.#ignoreUpdates = true
            this.#boxGraph.endTransaction()
            this.#boxGraph.verifyPointers()
            this.#ignoreUpdates = false
        }
        this.#boxesMap.observeDeep(eventHandler)
        return {terminate: () => {this.#boxesMap.unobserveDeep(eventHandler)}}
    }

    #updateValue([uuidAsString, fieldsKey, ...fieldKeys]: ReadonlyArray<string | number>, key: string): void {
        uuidAsString = String(uuidAsString)
        const uuid = UUID.parse(uuidAsString)
        const boxMap = this.#boxesMap.get(uuidAsString) as Y.Map<unknown>
        const fields = boxMap.get(String(fieldsKey)) as Y.Map<unknown>
        const box = this.#boxGraph.findBox(uuid).unwrap("Could not find box")
        const targetMap = Utils.findMap(fields, fieldKeys)
        console.debug("targetMap", uuidAsString, fieldKeys, targetMap)
        const vertexOption = box.searchVertex(Utils.pathKeyToFieldKeys(fieldKeys, key))
        console.debug("update", box.name, uuidAsString, fieldsKey, fieldKeys, key, vertexOption.unwrapOrNull(), targetMap, targetMap.get(key))
        vertexOption.unwrap("Could not find field").accept({
            visitField: (_: Field) => panic("Vertex must be either Primitive or Pointer"),
            visitArrayField: (_: ArrayField) => panic("Vertex must be either Primitive or Pointer"),
            visitObjectField: (_: ObjectField<any>) => panic("Vertex must be either Primitive or Pointer"),
            visitPointerField: (field: PointerField) => field.fromJSON(targetMap.get(key) as JSONValue),
            visitPrimitiveField: (field: PrimitiveField) => field.fromJSON(targetMap.get(key) as JSONValue)
        })
    }
}