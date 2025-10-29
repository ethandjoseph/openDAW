import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"

export const NoteRegionBox: BoxSchema<Pointers> = {
    type: "box",
    class: {
        name: "NoteRegionBox",
        fields: {
            1: {type: "pointer", name: "regions", pointerType: Pointers.RegionCollection, mandatory: true},
            2: {type: "pointer", name: "events", pointerType: Pointers.NoteEventCollection, mandatory: true},
            10: {type: "int32", name: "position"},
            11: {type: "int32", name: "duration"},
            12: {type: "int32", name: "loop-offset"},
            13: {type: "int32", name: "loop-duration"},
            14: {type: "int32", name: "event-offset"},
            15: {type: "boolean", name: "mute"},
            16: {type: "string", name: "label"},
            17: {type: "int32", name: "hue"}
        }
    }, pointerRules: {accepts: [Pointers.Selection, Pointers.Editing], mandatory: false}
}