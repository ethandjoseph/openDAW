import {ArrayField, Box, Field, Fields, ObjectField, PointerField, PrimitiveField, Vertex} from "@opendaw/lib-box"
import * as Y from "yjs"
import {asDefined, asInstanceOf, JSONValue} from "@opendaw/lib-std"

export namespace Utils {
    export const createBoxMap = (box: Box): Y.Map<unknown> => {
        const map = new Y.Map()
        map.set("name", box.name)
        map.set("fields", createMap(box.record()))
        return map
    }

    export const applyFromBoxMap = (box: Box, source: Y.Map<unknown>): void => {
        const writeBranch = (vertex: Vertex, map: Y.Map<unknown>) => {
            vertex.fields().forEach(field => {
                const value: unknown = map.get(String(field.fieldKey))
                field.accept({
                    visitArrayField: <FIELD extends Field>(field: ArrayField<FIELD>) =>
                        writeBranch(field, asInstanceOf(value, Y.Map)),
                    visitObjectField: <FIELDS extends Fields>(field: ObjectField<FIELDS>) =>
                        writeBranch(field, asInstanceOf(value, Y.Map)),
                    visitPointerField: (field: PointerField) => field.fromJSON(value as JSONValue),
                    visitPrimitiveField: (field: PrimitiveField) => field.fromJSON(value as JSONValue)
                })
            })
        }
        writeBranch(box, source)
    }

    export const pathKeyToFieldKeys = (fieldKeys: ReadonlyArray<string | number>, key: string): Int16Array => {
        const path = new Int16Array(fieldKeys.length + 1)
        fieldKeys.forEach((key, index) => path[index] = Number(key))
        path[fieldKeys.length] = Number(key)
        return path
    }

    export const findMap = (map: Y.Map<unknown>, fieldKeys: ReadonlyArray<string | number>): Y.Map<unknown> =>
        fieldKeys.reduce((map, key) => asDefined(map.get(String(key)), "Could not findMap") as Y.Map<unknown>, map)

    const createMap = (struct: Readonly<Record<string, Field>>): Y.Map<unknown> => Object.entries(struct)
        .reduce((map, [key, field]) => {
            field.accept({
                visitPrimitiveField: (field: PrimitiveField): unknown => map.set(key, field.toJSON() ?? null),
                visitPointerField: (field: PointerField): unknown => map.set(key, field.toJSON() ?? null),
                visitArrayField: (field: ArrayField): unknown => map.set(key, createMap(field.record())),
                visitObjectField: (field: ObjectField<any>): unknown => map.set(key, createMap(field.record()))
            })
            return map
        }, new Y.Map())
}