import {asDefined, assert, EmptyExec, Exec, JSONValue, Terminable, Terminator, UUID} from "@opendaw/lib-std"
import {Address, ArrayField, Box, BoxGraph, ObjectField, Update, Vertex} from "@opendaw/lib-box"
import {LiveList, LiveMap, LiveObject, LsonObject, Room} from "@liveblocks/client"
import {LiveblocksSerializer} from "./LiveblocksSerializer"

export type ProjectRoot = {
    boxes: LiveMap<string, LiveObject<BoxLiveObject>>
}

export type BoxLiveObject = {
    name: string,
    fields: LiveObject<LsonObject>
}

export type AnyLiveNode = LiveObject<any> | LiveList<any> | LiveMap<any, any>

export class LiveblocksSync<T> implements Terminable {
    static join<T>(boxGraph: BoxGraph<T>, room: Room, root: LiveObject<ProjectRoot>): LiveblocksSync<T> {
        assert(boxGraph.boxes().length === 0, "BoxGraph must be empty")
        const sync = new LiveblocksSync<T>(boxGraph, room, root)
        sync.#boxGraph.beginTransaction()
        sync.#liveBoxMap.forEach((object: LiveObject<BoxLiveObject>, id) => sync.#newBoxFromLiveObject(UUID.parse(id), object))
        sync.#boxGraph.endTransaction()
        // sync.#boxGraph.verifyPointers()
        return sync
    }

    static populate<T>(boxGraph: BoxGraph<T>, room: Room, root: LiveObject<ProjectRoot>): LiveblocksSync<T> {
        const boxes = root.get("boxes")
        assert(boxes.size === 0, "root must be empty")
        const sync = new LiveblocksSync<T>(boxGraph, room, root)
        boxGraph.boxes().forEach(box => boxes.set(box.address.toString(), LiveblocksSerializer.fromBox(box)))
        return sync
    }

    readonly #terminator = new Terminator()

    readonly #boxGraph: BoxGraph<T>
    readonly #room: Room
    readonly #liveBoxMap: LiveMap<string, LiveObject<BoxLiveObject>>

    readonly #addressMap: WeakMap<AnyLiveNode, Address>
    readonly #updates: Array<Update>

    #doNotSend: boolean = false

    private constructor(boxGraph: BoxGraph<T>, room: Room, root: LiveObject<ProjectRoot>) {
        this.#boxGraph = boxGraph
        this.#room = room
        this.#liveBoxMap = root.get("boxes")

        this.#addressMap = new WeakMap()
        this.#updates = []

        this.#terminator.ownAll(
            this.#boxGraph.subscribeTransaction({
                onBeginTransaction: EmptyExec,
                onEndTransaction: () => {
                    if (this.#doNotSend) {return}
                    room.batch(() => this.#updates.forEach(update => {
                        /**
                         * TRANSFER CHANGES FROM OPENDAW TO LIVEBLOCKS
                         */
                        if (update.type === "new") {
                            const uuid = update.uuid
                            const key = UUID.toString(uuid)
                            const box = this.#boxGraph.findBox(uuid).unwrap()
                            const object = LiveblocksSerializer.fromBox(box)
                            this.#collectFieldKeys(box, object.get("fields"))
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
                            const boxObject = asDefined(this.#liveBoxMap.get(key),
                                "Could not find box") as LiveObject<BoxLiveObject>
                            const {address: {fieldKeys}, newAddress} = update
                            let field = boxObject.get("fields") as LiveObject<any>
                            for (let i = 0; i < fieldKeys.length - 1; i++) {
                                field = asDefined(field.get(String(fieldKeys[i])), `No field at '${fieldKeys[i]}'`)
                            }
                            field.set(fieldKeys[fieldKeys.length - 1], newAddress.unwrapOrNull()?.toString())
                        } else if (update.type === "delete") {
                            this.#liveBoxMap.delete(UUID.toString(update.uuid))
                        }
                    }))
                    this.#updates.length = 0
                }
            }),
            this.#boxGraph.subscribeToAllUpdatesImmediate({
                onUpdate: (update: Update): unknown => this.#updates.push(update)
            }),
            Terminable.create(this.#room.subscribe(this.#liveBoxMap, (events) => {
                /**
                 * TRANSFER CHANGES FROM LIVEBLOCKS TO OPENDAW
                 */
                events.forEach(event => {
                    if (event.node === this.#liveBoxMap) {
                        const updates = Object.entries(event.updates)
                        this.#modifyBoxGraph(() => {
                            updates.forEach(([key, _]) => {
                                const uuid = UUID.parse(key)
                                if (this.#boxGraph.findBox(uuid).nonEmpty()) {
                                    // We created this box and got an echo
                                    return
                                }
                                const boxObject = this.#liveBoxMap.get(key) as LiveObject<BoxLiveObject>
                                this.#newBoxFromLiveObject(uuid, boxObject)
                            })
                        })
                    } else {
                        const node = event.node as AnyLiveNode
                        const address = asDefined(this.#addressMap.get(node), `No address for node '${node}'`)
                        const box = this.#boxGraph.findBox(address.uuid).unwrap("Could not locate box")
                        const updates = Object.entries(event.updates)
                        this.#modifyBoxGraph(() => updates.forEach(([key, value]) => {
                            const leaf = address.append(parseInt(key))
                            console.debug(`We have an '${value?.type}' at ${leaf.toString()} to: '${node.get(key)}'`)
                            const target = box.searchVertex(leaf.fieldKeys).unwrap("Could not locate field to be updated")
                            target.fromJSON(node.get(key) as JSONValue)
                        }))
                    }
                })
            }, {isDeep: true}))
        )
    }

    localEdit(exec: Exec): void {
        assert(!this.#doNotSend, "Cannot send")
        console.debug("localEdit")
        this.#boxGraph.beginTransaction()
        exec()
        this.#boxGraph.endTransaction()
    }

    terminate(): void {this.#terminator.terminate()}

    #newBoxFromLiveObject(uuid: UUID.Bytes, liveObject: LiveObject<BoxLiveObject>): Box {
        const name = liveObject.get("name") as keyof T
        const box = this.#boxGraph.createBox(name, uuid, box => box.fromJSON(liveObject.toImmutable().fields as JSONValue))
        this.#collectFieldKeys(box, liveObject.get("fields"))
        console.debug("new box from liveblocks", box.name, JSON.stringify(box.toJSON()))
        return box
    }

    #collectFieldKeys(vertex: Vertex, node: AnyLiveNode): void {
        vertex.fields().forEach(field => {
            const object = node.get(String(field.fieldKey))
            field.accept({
                visitArrayField: (field: ArrayField) =>
                    this.#collectFieldKeys(field, this.#storePath(object, field.address)),
                visitObjectField: (field: ObjectField<{}>) =>
                    this.#collectFieldKeys(field, this.#storePath(object, field.address))
            })
        })
    }

    #storePath<T extends AnyLiveNode>(value: T, address: Address): T {
        this.#addressMap.set(value, address)
        return value
    }

    #modifyBoxGraph(exec: Exec): void {
        this.#boxGraph.beginTransaction()
        exec()
        this.#doNotSend = true
        this.#boxGraph.endTransaction()
        this.#doNotSend = false
    }
}