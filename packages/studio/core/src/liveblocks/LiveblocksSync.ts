import {
    asDefined,
    assert,
    EmptyExec,
    Exec,
    isUndefined,
    Optional,
    SortedSet,
    Subscription,
    Terminable,
    Terminator,
    UUID
} from "@opendaw/lib-std"
import {ArrayField, Box, BoxGraph, ObjectField, PointerField, PrimitiveField, Update, Vertex} from "@opendaw/lib-box"
import {LiveList, LiveMap, LiveObject, LsonObject, Room} from "@liveblocks/client"
import {LiveblocksSerializer} from "./LiveblocksSerializer"

export type ProjectRoot = {
    boxes: LiveMap<string, LiveObject<BoxLiveObject>>
}

export type BoxLiveObject = {
    name: string,
    fields: LiveObject<LsonObject>
}

export type BoxSubscription = {
    uuid: UUID.Bytes
    terminator: Terminator
}

export type AnyLiveNode = LiveObject<any> | LiveList<any> | LiveMap<any, any>

export class LiveblocksSync<T> implements Terminable {
    static populate<T>(boxGraph: BoxGraph<T>, room: Room, root: LiveObject<ProjectRoot>): LiveblocksSync<T> {
        const boxes = root.get("boxes")
        assert(boxes.size === 0, "root must be empty")
        const sync = new LiveblocksSync<T>(boxGraph, room, root)
        room.batch(() => boxGraph.boxes().forEach(box => {
            const object = LiveblocksSerializer.fromBox(box)
            boxes.set(UUID.toString(box.address.uuid), object)
            sync.#subscribeBox(object, box)
        }))
        return sync
    }

    static join<T>(boxGraph: BoxGraph<T>, room: Room, root: LiveObject<ProjectRoot>): LiveblocksSync<T> {
        assert(boxGraph.boxes().length === 0, "BoxGraph must be empty")
        const sync = new LiveblocksSync<T>(boxGraph, room, root)
        sync.#boxGraph.beginTransaction()
        sync.#liveBoxMap.forEach((object: LiveObject<BoxLiveObject>, id) => sync.#newBoxFromLiveObject(UUID.parse(id), object))
        sync.#boxGraph.endTransaction()
        sync.#boxGraph.verifyPointers()
        return sync
    }

    readonly #terminator = new Terminator()

    readonly #boxGraph: BoxGraph<T>
    readonly #room: Room
    readonly #liveBoxMap: LiveMap<string, LiveObject<BoxLiveObject>>

    readonly #subscriptions: SortedSet<UUID.Bytes, BoxSubscription>
    readonly #updates: Array<Update>

    #ignoreUpdates: boolean = false

    private constructor(boxGraph: BoxGraph<T>, room: Room, root: LiveObject<ProjectRoot>) {
        this.#boxGraph = boxGraph
        this.#room = room
        this.#liveBoxMap = root.get("boxes")

        this.#subscriptions = UUID.newSet<BoxSubscription>(({uuid}) => uuid)
        this.#updates = []

        this.#terminator.ownAll(
            this.#boxGraph.subscribeTransaction({
                onBeginTransaction: EmptyExec,
                onEndTransaction: () => {
                    if (this.#ignoreUpdates) {
                        this.#updates.length = 0
                        return
                    }
                    room.batch(() => this.#updates.forEach(update => {
                        /**
                         * TRANSFER CHANGES FROM OPENDAW TO LIVEBLOCKS
                         */
                        if (update.type === "new") {
                            const uuid = update.uuid
                            const key = UUID.toString(uuid)
                            const box = this.#boxGraph.findBox(uuid).unwrap()
                            const object = LiveblocksSerializer.fromBox(box)
                            this.#subscribeBox(object, box)
                            this.#liveBoxMap.set(key, object)
                        } else if (update.type === "primitive") {
                            const key = UUID.toString(update.address.uuid)
                            const boxObject = asDefined(this.#liveBoxMap.get(key),
                                "Could not find box") as LiveObject<BoxLiveObject>
                            const {address: {fieldKeys}, newValue} = update
                            let field = boxObject.get("fields") as LiveObject<any>
                            for (let i = 0; i < fieldKeys.length - 1; i++) {
                                field = asDefined(field.get(String(fieldKeys[i])), `No field at '${fieldKeys[i]}'`)
                            }
                            field.set(fieldKeys[fieldKeys.length - 1], newValue)
                        } else if (update.type === "pointer") {
                            const key = UUID.toString(update.address.uuid)
                            const boxObject = this.#liveBoxMap.get(key) as Optional<LiveObject<BoxLiveObject>>
                            if (isUndefined(boxObject)) {
                                console.warn("Could not find box", key)
                                return
                            }
                            const {address: {fieldKeys}, newAddress} = update
                            let field = boxObject.get("fields") as LiveObject<any>
                            for (let i = 0; i < fieldKeys.length - 1; i++) {
                                field = asDefined(field.get(String(fieldKeys[i])), `No field at '${fieldKeys[i]}'`)
                            }
                            field.set(fieldKeys[fieldKeys.length - 1], newAddress.unwrapOrNull()?.toString())
                        } else if (update.type === "delete") {
                            const uuid = update.uuid
                            this.#subscriptions.removeByKey(uuid).terminator.terminate()
                            this.#liveBoxMap.delete(UUID.toString(uuid))
                        }
                    }))
                    this.#updates.length = 0
                }
            }),
            this.#boxGraph.subscribeToAllUpdatesImmediate({
                onUpdate: (update: Update): unknown => this.#updates.push(update)
            }),
            Terminable.create(this.#room.subscribe(this.#liveBoxMap, (boxes) => {
                /**
                 * TRANSFER CHANGES FROM LIVEBLOCKS TO OPENDAW
                 */
                boxes.forEach((object, key) => {
                    const uuid = UUID.parse(key)
                    if (this.#boxGraph.findBox(uuid).isEmpty()) {
                        this.#modifyBoxGraph(() => this.#newBoxFromLiveObject(uuid, object))
                    }
                })
                const remove: Array<Box> = []
                this.#boxGraph.boxes().forEach((box) => {
                    if (!boxes.has(UUID.toString(box.address.uuid))) {
                        remove.push(box)
                    }
                })
                if (remove.length > 0) {
                    this.#modifyBoxGraph(() => remove.forEach(box => {
                        console.debug("remove", box.name, box.address.toString())
                        console.debug(box.outgoingEdges().length, box.incomingEdges().length, box.isAttached())
                        if (box.isAttached()) {
                            box.delete()
                        }
                    }))
                }
            }))
        )
    }

    terminate(): void {this.#terminator.terminate()}

    #newBoxFromLiveObject(uuid: UUID.Bytes, liveObject: LiveObject<BoxLiveObject>): void {
        const name = liveObject.get("name") as keyof T
        const box = this.#boxGraph.createBox(name, uuid, box => LiveblocksSerializer.intoBox(box, liveObject))
        this.#subscribeBox(liveObject, box)
    }

    #subscribeBox(object: LiveObject<BoxLiveObject>, box: Box): void {
        const terminator: Terminator = new Terminator()
        this.#subscribeCollection(terminator, object.get("fields"), box)
        this.#subscriptions.add({uuid: box.address.uuid, terminator})
    }

    #subscribeCollection(terminator: Terminator, node: AnyLiveNode, vertex: Vertex): void {
        terminator.own(this.#subscribeNode(node, vertex))
        vertex.fields().forEach(field => field.accept({
            visitArrayField: (field: ArrayField) =>
                this.#subscribeCollection(terminator, LiveblocksSerializer.anyLiveNodeAt(node, field.fieldKey), field),
            visitObjectField: (field: ObjectField<{}>) =>
                this.#subscribeCollection(terminator, LiveblocksSerializer.anyLiveNodeAt(node, field.fieldKey), field)
        }))
    }

    #subscribeNode(node: AnyLiveNode, vertex: Vertex): Subscription {
        return Terminable.create(this.#room.subscribe(node, () => {
            vertex.fields().forEach(field => field.accept({
                visitPointerField: (field: PointerField) =>
                    this.#modifyBoxGraph(() => LiveblocksSerializer.writeField(node, field)),
                visitPrimitiveField: (field: PrimitiveField) =>
                    this.#modifyBoxGraph(() => LiveblocksSerializer.writeField(node, field))
            }))
        }))
    }

    #modifyBoxGraph(exec: Exec): void {
        this.#boxGraph.beginTransaction()
        exec()
        this.#ignoreUpdates = true
        this.#boxGraph.endTransaction()
        this.#ignoreUpdates = false
    }
}