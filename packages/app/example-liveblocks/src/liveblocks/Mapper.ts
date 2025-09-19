import {
    asDefined,
    assert,
    EmptyExec,
    Exec,
    isNotUndefined,
    JSONValue,
    Optional,
    SortedSet,
    Subscription,
    Terminable,
    Terminator,
    UUID
} from "@opendaw/lib-std"
import {
    Address,
    ArrayField,
    Box,
    BoxGraph,
    Field,
    FieldKey,
    FieldKeys,
    Fields,
    ObjectField,
    PointerField,
    PrimitiveField,
    PrimitiveUpdate,
    Update,
    Vertex
} from "@opendaw/lib-box"
import {Lson} from "@liveblocks/core"
import {LiveList, LiveMap, LiveObject, LsonObject, Room} from "@liveblocks/client"

export type ProjectRoot = {
    boxes: LiveMap<string, LiveObject<BoxLiveObject>>
}

export type BoxLiveObject = {
    name: string,
    fields: LiveObject<LsonObject>
}

export type AnyLiveNode = LiveObject<any> | LiveList<any> | LiveMap<any, any>

type BoxSubscription = {
    uuid: UUID.Bytes,
    subscription: Subscription
}

export class Mapper<T> implements Terminable {
    readonly #terminator = new Terminator()

    readonly #boxGraph: BoxGraph<T>
    readonly #room: Room
    readonly #boxes: LiveMap<string, LiveObject<BoxLiveObject>>

    readonly #fieldKeysMap: WeakMap<AnyLiveNode, FieldKeys>
    readonly #boxSubscriptions: SortedSet<UUID.Bytes, BoxSubscription>
    readonly #updates: Array<Update>

    #doNotSend: boolean = false

    constructor(boxGraph: BoxGraph<T>, room: Room, root: LiveObject<ProjectRoot>) {
        this.#boxGraph = boxGraph
        this.#room = room
        this.#boxes = root.get("boxes")

        this.#fieldKeysMap = new WeakMap()
        this.#boxSubscriptions = UUID.newSet<BoxSubscription>(({uuid}) => uuid)
        this.#updates = []

        assert(boxGraph.boxes().length === 0, "BoxGraph must be empty")

        this.#boxGraph.beginTransaction()
        this.#boxes.forEach((object: LiveObject<BoxLiveObject>, id) => {
            const box = this.#createNewBoxFromLiveObject(UUID.parse(id), object)
            console.debug("created", JSON.stringify(box.toJSON()))
            this.#boxSubscriptions.add({
                uuid: box.address.uuid,
                subscription: this.#subscribeToBoxLiveObject(box.address.uuid, object)
            })
        })
        this.#boxGraph.endTransaction()

        this.#terminator.ownAll(
            this.#boxGraph.subscribeTransaction({
                onBeginTransaction: EmptyExec,
                onEndTransaction: () => {
                    if (this.#doNotSend) {return}
                    room.batch(() => this.#updates.forEach(update => {
                        if (update.type === "primitive") {
                            const key = UUID.toString(update.address.uuid)
                            const boxObject = asDefined(this.#boxes.get(key), "Could not find box") as LiveObject<BoxLiveObject>
                            this.#updatePrimitiveInBoxLiveObject(boxObject, update)
                        } else if (update.type === "delete") {
                            this.#boxSubscriptions.removeByKey(update.uuid).subscription.terminate()
                        }
                    }))
                    this.#updates.length = 0
                }
            }),
            this.#boxGraph.subscribeToAllUpdatesImmediate({
                onUpdate: (update: Update): unknown => this.#updates.push(update)
            })
        )
    }

    debugEdit(exec: Exec): void {
        assert(!this.#doNotSend, "Cannot send")
        this.#boxGraph.beginTransaction()
        exec()
        this.#boxGraph.endTransaction()
    }

    boxToLiveObject(box: Box): LiveObject<BoxLiveObject> {
        return new LiveObject<BoxLiveObject>({
            name: box.name,
            fields: new LiveObject(this.#fieldsToLsonObject(box.fields()))
        })
    }

    fieldKeysForAnyLiveNode(node: AnyLiveNode): FieldKeys {
        return asDefined(this.#fieldKeysMap.get(node), `No 'FieldKeys' for node '${node}'`)
    }

    terminate(): void {this.#terminator.terminate()}

    #subscribeToBoxLiveObject(uuid: UUID.Bytes, liveObject: LiveObject<BoxLiveObject>) {
        return Terminable.create(this.#room.subscribe(liveObject, ([event, ...rest]) => {
            assert(rest.length === 0, `We received more events: '${rest}'`)
            console.debug("-- ROOM CHANGE --")
            this.#boxGraph.beginTransaction()
            const box = this.#boxGraph.findBox(uuid).unwrap("Could not locate box")
            const node = event.node as AnyLiveNode
            const fieldKeys = this.fieldKeysForAnyLiveNode(node)
            const updates = Object.entries(event.updates)
            console.debug(`Box ${UUID.toString(uuid)} (${liveObject.get("name")}) was updated`, updates.length)
            updates.forEach(([key, value]) => {
                console.debug(`We have an '${value?.type}' at: [${fieldKeys},${key}]. value: '${node.get(key)}'`)
                const target = box.searchVertex(new Int16Array([...fieldKeys, parseInt(key)]))
                    .unwrap("Could not locate field to be updated")
                target.fromJSON(node.get(key) as JSONValue)
            })
            this.#doNotSend = true
            this.#boxGraph.endTransaction()
            this.#doNotSend = false
        }, {isDeep: true}))
    }

    #createNewBoxFromLiveObject(uuid: UUID.Bytes, object: LiveObject<BoxLiveObject>): Box {
        const name = object.get("name") as keyof T
        const box = this.#boxGraph.createBox(name, uuid, box => box.fromJSON(object.toImmutable().fields as JSONValue))
        this.#collectFieldKeys(box, object.get("fields"))
        return box
    }

    #fieldsToLsonObject(fields: ReadonlyArray<Field>): LsonObject {
        return fields.reduce((object: Record<FieldKey, Lson>, field) => {
            const value = this.#fieldToLson(field)
            if (isNotUndefined(value)) {
                object[field.fieldKey] = value
            }
            return object
        }, {})
    }

    #updatePrimitiveInBoxLiveObject(target: LiveObject<BoxLiveObject>, update: PrimitiveUpdate): void {
        const {address: {fieldKeys}, newValue} = update
        let field = target.get("fields") as LiveObject<any>
        for (let i = 0; i < fieldKeys.length - 1; i++) {
            field = asDefined(field.get(String(fieldKeys[i])), `No field at '${fieldKeys[i]}'`)
        }
        field.set(fieldKeys[fieldKeys.length - 1], newValue)
    }

    #fieldToLson(field: Field): Optional<Lson> {
        return field.accept<Optional<Lson>>({
            visitPrimitiveField: (field: PrimitiveField) => field.toJSON() ?? null,
            visitPointerField: (field: PointerField) => field.toJSON() ?? null,
            visitObjectField: <FIELDS extends Fields>(field: ObjectField<FIELDS>) =>
                this.#storePath(new LiveObject(this.#fieldsToLsonObject(field.fields())), field.address),
            visitArrayField: <FIELD extends Field>(field: ArrayField<FIELD>) =>
                this.#storePath(new LiveList(field.fields().map(field => this.#fieldToLson(field) ?? null)), field.address),
            visitField: (_field: Field) => undefined // this will not be exposed to liveblocks
        })
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
        this.#fieldKeysMap.set(value, address.fieldKeys)
        return value
    }
}