import {asDefined, isNotUndefined, JSONValue, Optional, UUID} from "@opendaw/lib-std"
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
    Vertex
} from "@opendaw/lib-box"
import {Lson} from "@liveblocks/core"
import {LiveList, LiveMap, LiveObject, LsonObject} from "@liveblocks/client"
import {BoxIO} from "@opendaw/studio-boxes"

export type BoxLiveObject = {
    id: string,
    name: string,
    fields: LiveObject<LsonObject>
}

export type AnyLiveNode = LiveObject<any> | LiveList<any> | LiveMap<any, any>

export class Liveblocks {
    readonly #pathMap: WeakMap<AnyLiveNode, FieldKeys>

    constructor() {
        this.#pathMap = new WeakMap()
    }

    boxToLiveObject(box: Box): LiveObject<BoxLiveObject> {
        return new LiveObject<BoxLiveObject>({
            id: box.address.toString(),
            name: box.name,
            fields: new LiveObject(this.fieldsToLsonObject(box.fields()))
        })
    }

    createNewBoxFromLiveObject(boxGraph: BoxGraph, object: LiveObject<BoxLiveObject>): Box {
        const name = object.get("name") as keyof BoxIO.TypeMap
        const uuid = UUID.parse(object.get("id"))
        const box = boxGraph.createBox(name, uuid, box => box.fromJSON(object.toImmutable().fields as JSONValue))
        this.#collectFieldKeys(box, object.get("fields"))
        return box
    }

    fieldsToLsonObject(fields: ReadonlyArray<Field>): LsonObject {
        return fields.reduce((object: Record<FieldKey, Lson>, field) => {
            const value = this.#fieldToLson(field)
            if (isNotUndefined(value)) {
                object[field.fieldKey] = value
            }
            return object
        }, {})
    }

    updatePrimitiveInBoxLiveObject(target: LiveObject<BoxLiveObject>, update: PrimitiveUpdate): void {
        const {address: {fieldKeys}, newValue} = update
        let field = target.get("fields") as LiveObject<any>
        for (let i = 0; i < fieldKeys.length - 1; i++) {
            field = asDefined(field.get(String(fieldKeys[i])), `No field at '${fieldKeys[i]}'`)
        }
        field.set(fieldKeys[fieldKeys.length - 1], newValue)
    }

    fieldKeysForAnyLiveNode(node: AnyLiveNode): FieldKeys {
        console.debug("fieldKeysForAnyLiveNode", this.#pathMap)
        return asDefined(this.#pathMap.get(node), `No 'FieldKeys' for node '${node}'`)
    }

    #fieldToLson(field: Field): Optional<Lson> {
        return field.accept<Optional<Lson>>({
            visitPrimitiveField: (field: PrimitiveField) => field.toJSON() ?? null,
            visitPointerField: (field: PointerField) => field.toJSON() ?? null,
            visitObjectField: <FIELDS extends Fields>(field: ObjectField<FIELDS>) =>
                this.#storePath(new LiveObject(this.fieldsToLsonObject(field.fields())), field.address),
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
        this.#pathMap.set(value, address.fieldKeys)
        return value
    }
}