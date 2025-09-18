import {Optional} from "@opendaw/lib-std"
import {ArrayField, Box, Field, Fields, ObjectField, PointerField, PrimitiveField} from "@opendaw/lib-box"
import {Lson} from "@liveblocks/core"
import {LiveList, LiveObject, LsonObject} from "@liveblocks/client"

export namespace Liveblocks {
    export const boxToLiveObject = (box: Box) => {
        return new LiveObject({
            id: box.address.toString(),
            name: box.name,
            creationIndex: box.creationIndex,
            fields: new LiveObject(fieldsToLiveObjects(box.fields()))
        })
    }

    const fieldToLson = (field: Field): Optional<Lson> => field.accept<Optional<Lson>>({
        visitPrimitiveField: (field: PrimitiveField) => field.toJSON() ?? null,
        visitPointerField: (field: PointerField) => field.toJSON() ?? null,
        visitObjectField: <FIELDS extends Fields>(field: ObjectField<FIELDS>) => new LiveObject(fieldsToLiveObjects(field.fields())),
        visitArrayField: <FIELD extends Field>(field: ArrayField<FIELD>) => new LiveList(field.fields().map(field => fieldToLson(field) ?? null)),
        visitField: (_field: Field) => undefined // this will not be exposed to liveblocks
    })

    const fieldsToLiveObjects = (fields: ReadonlyArray<Field>): LsonObject => fields.reduce((object: any, field) => {
        object[field.fieldKey] = fieldToLson(field)
        return object
    }, {})
}