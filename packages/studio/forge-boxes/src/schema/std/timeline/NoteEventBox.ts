import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"
import {PPQN} from "@opendaw/lib-dsp"

export const NoteEventBox: BoxSchema<Pointers> = {
    type: "box",
    class: {
        name: "NoteEventBox",
        fields: {
            1: {type: "pointer", name: "events", pointerType: Pointers.NoteEvents, mandatory: true},
            10: {type: "int32", name: "position"},
            11: {type: "int32", name: "duration", value: PPQN.SemiQuaver}, // [1...]
            20: {type: "int32", name: "pitch", value: 60}, // [0...127]
            21: {type: "float32", name: "velocity", value: 100.0 / 127.0}, // [0...1]
            22: {type: "int32", name: "play-count", value: 1}, // [1...128]
            23: {type: "float32", name: "play-curve", value: 0.0}, // [-1...1]
            24: {type: "float32", name: "cent", value: 0}, // [-50...50]
            25: {type: "int32", name: "chance", value: 100} // [1...100]
        }
    }, pointerRules: {accepts: [Pointers.Selection, Pointers.NoteEventFeature], mandatory: false}
}