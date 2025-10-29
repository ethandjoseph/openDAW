import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"

export const ValueRegionBox: BoxSchema<Pointers> = {
    type: "box",
    class: {
        name: "ValueRegionBox",
        fields: {
            1: {type: "pointer", name: "regions", pointerType: Pointers.RegionCollection, mandatory: true},
            2: {type: "pointer", name: "events", pointerType: Pointers.ValueEventCollection, mandatory: true},
            10: {type: "int32", name: "position"},
            11: {type: "int32", name: "duration"},
            12: {type: "int32", name: "loop-offset"},
            13: {type: "int32", name: "loop-duration"},
            14: {type: "boolean", name: "mute"},
            15: {type: "string", name: "label"},
            16: {type: "int32", name: "hue"}
        }
    }, pointerRules: {accepts: [Pointers.Selection, Pointers.Editing], mandatory: false}
}