import {ArrayField, Box, Field, FieldKey, Fields, ObjectField, PointerField, PrimitiveField} from "@opendaw/lib-box"
import {isNotUndefined, Optional} from "@opendaw/lib-std"
import {Lson} from "@liveblocks/core"
import {LiveList, LiveObject, LsonObject} from "@liveblocks/client"
import {BoxLiveObject} from "./LiveblocksSync"

export class LiveblocksSerializer {
    static fromBox(box: Box): LiveObject<BoxLiveObject> {
        return new LiveObject<BoxLiveObject>({
            name: box.name,
            fields: new LiveObject(LiveblocksSerializer.toLsonObject(box.fields()))
        })
    }

    static toLson(field: Field): Optional<Lson> {
        return field.accept<Optional<Lson>>({
            visitPrimitiveField: (field: PrimitiveField) => field.toJSON() ?? null,
            visitPointerField: (field: PointerField) => field.toJSON() ?? null,
            visitObjectField: <FIELDS extends Fields>(field: ObjectField<FIELDS>) =>
                new LiveObject(this.toLsonObject(field.fields())),
            visitArrayField: <FIELD extends Field>(field: ArrayField<FIELD>) =>
                new LiveList(field.fields().map(field => this.toLson(field) ?? null)),
            visitField: (_field: Field) => undefined // this will not be exposed to liveblocks
        })
    }

    static toLsonObject(fields: ReadonlyArray<Field>): LsonObject {
        return fields.reduce((object: Record<FieldKey, Lson>, field) => {
            const value = this.toLson(field)
            if (isNotUndefined(value)) {
                object[field.fieldKey] = value
            }
            return object
        }, {})
    }
}