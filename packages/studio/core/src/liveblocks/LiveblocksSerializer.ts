import {asDefined, isInstanceOf, isNotUndefined, JSONValue, Optional, panic} from "@opendaw/lib-std"
import {ArrayField, Box, Field, FieldKey, Fields, ObjectField, PointerField, PrimitiveField} from "@opendaw/lib-box"
import {Lson} from "@liveblocks/core"
import {LiveList, LiveObject, LsonObject} from "@liveblocks/client"
import {AnyLiveNode, BoxLiveObject} from "./LiveblocksSync"

export class LiveblocksSerializer {
    static fromBox(box: Box): LiveObject<BoxLiveObject> {
        return new LiveObject<BoxLiveObject>({
            name: box.name,
            fields: new LiveObject(this.toLsonObject(box.fields()))
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

    static intoBox(box: Box, object: LiveObject<BoxLiveObject>) {
        const into = (source: AnyLiveNode, fields: ReadonlyArray<Field>) => {
            fields.forEach(field => {
                const value = isInstanceOf(source, LiveList) ? source.get(field.fieldKey) : source.get(String(field.fieldKey))
                field.accept({
                    visitArrayField: <FIELD extends Field>(field: ArrayField<FIELD>) =>
                        into(this.anyLiveNodeAt(source, field.fieldKey), field.fields()),
                    visitObjectField: <FIELDS extends Fields>(field: ObjectField<FIELDS>) =>
                        into(this.anyLiveNodeAt(source, field.fieldKey), field.fields()),
                    visitPointerField: (field: PointerField) => field.fromJSON(value),
                    visitPrimitiveField: (field: PrimitiveField) => field.fromJSON(value)
                })
            })
        }
        into(object.get("fields"), box.fields())
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

    static anyLiveNodeAt(object: AnyLiveNode, fieldKey: FieldKey): AnyLiveNode {
        if (isInstanceOf(object, LiveObject)) {
            return asDefined(object.get(String(fieldKey)), `No field at '${fieldKey}'`)
        } else if (isInstanceOf(object, LiveList)) {
            return asDefined(object.get(fieldKey), `No field at '${fieldKey}'`)
        } else {
            return panic("Unknown type")
        }
    }

    static writeField(object: AnyLiveNode, field: Field): void {
        const value = this.readProperty(object, field)
        console.debug("writeProperty", field, value)
        if (isInstanceOf(object, LiveObject)) {
            field.fromJSON(value)
        } else if (isInstanceOf(object, LiveList)) {
            field.fromJSON(value)
        } else {
            return panic("Unknown type")
        }
    }

    static readProperty(object: AnyLiveNode, field: Field): JSONValue {
        if (isInstanceOf(object, LiveObject)) {
            return object.get(String(field.fieldKey))
        } else if (isInstanceOf(object, LiveList)) {
            return object.get(field.fieldKey)
        } else {
            return panic("Unknown type")
        }
    }
}