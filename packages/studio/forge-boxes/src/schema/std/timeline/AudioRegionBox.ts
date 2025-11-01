import {BoxSchema} from "@opendaw/lib-box-forge"
import {AudioPlayback, Pointers, TimeBase} from "@opendaw/studio-enums"

export const AudioRegionBox: BoxSchema<Pointers> = {
    type: "box",
    class: {
        name: "AudioRegionBox",
        fields: {
            1: {type: "pointer", name: "regions", pointerType: Pointers.RegionCollection, mandatory: true},
            2: {type: "pointer", name: "file", pointerType: Pointers.AudioFile, mandatory: true},
            3: {type: "string", name: "playback", value: AudioPlayback.Pitch},
            4: {type: "string", name: "time-base", value: TimeBase.Musical},
            10: {type: "int32", name: "position"},
            11: {type: "int32", name: "duration"},
            12: {type: "int32", name: "loop-offset"},
            13: {type: "int32", name: "loop-duration"},
            14: {type: "boolean", name: "mute"},
            15: {type: "string", name: "label"},
            16: {type: "int32", name: "hue"},
            17: {type: "float32", name: "gain"}
        }
    }, pointerRules: {accepts: [Pointers.Selection, Pointers.Editing], mandatory: false}
}