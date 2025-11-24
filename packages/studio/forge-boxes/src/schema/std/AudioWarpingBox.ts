import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"

export const AudioWarpingBox: BoxSchema<Pointers> = {
    type: "box",
    class: {
        name: "AudioWarpingBox",
        fields: {
            10: {type: "bytes", name: "warp-markers"},
            11: {type: "bytes", name: "transient-markers"}
        }
    }, pointerRules: {accepts: [Pointers.AudioWarping], mandatory: true}
}