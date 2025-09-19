import {asDefined, isNotUndefined, Optional} from "@opendaw/lib-std"
import {
    ArrayField,
    Box,
    Field,
    FieldKey,
    Fields,
    ObjectField,
    PointerField,
    PrimitiveField,
    PrimitiveUpdate
} from "@opendaw/lib-box"
import {Lson} from "@liveblocks/core"
import {LiveList, LiveObject, LsonObject} from "@liveblocks/client"

export type BoxLiveObject = {
    id: string,
    name: string,
    fields: LiveObject<LsonObject>
}

export namespace Liveblocks {
    export const boxToLiveObject = (box: Box): LiveObject<BoxLiveObject> => {
        return new LiveObject<BoxLiveObject>({
            id: box.address.toString(),
            name: box.name,
            fields: new LiveObject(fieldsToLsonObject(box.fields()))
        })
    }

    export const fieldsToLsonObject = (fields: ReadonlyArray<Field>): LsonObject =>
        fields.reduce((object: Record<FieldKey, Lson>, field) => {
            const value = fieldToLson(field)
            if (isNotUndefined(value)) {
                object[field.fieldKey] = value
            }
            return object
        }, {})

    export const updatePrimitiveInBoxLiveObject = (target: LiveObject<BoxLiveObject>, update: PrimitiveUpdate): void => {
        const {address: {fieldKeys}, newValue} = update
        let field = target.get("fields") as LiveObject<any>
        for (let i = 0; i < fieldKeys.length - 1; i++) {
            field = asDefined(field.get(String(fieldKeys[i])), `No field at '${fieldKeys[i]}'`)
        }
        field.set(fieldKeys[fieldKeys.length - 1], newValue)
    }

    const fieldToLson = (field: Field): Optional<Lson> => field.accept<Optional<Lson>>({
        visitPrimitiveField: (field: PrimitiveField) => field.toJSON() ?? null,
        visitPointerField: (field: PointerField) => field.toJSON() ?? null,
        visitObjectField: <FIELDS extends Fields>(field: ObjectField<FIELDS>) =>
            new LiveObject(fieldsToLsonObject(field.fields())),
        visitArrayField: <FIELD extends Field>(field: ArrayField<FIELD>) =>
            new LiveList(field.fields().map(field => fieldToLson(field) ?? null)),
        visitField: (_field: Field) => undefined // this will not be exposed to liveblocks
    })
}