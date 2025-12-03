import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"

export const AudioWarpingBox: BoxSchema<Pointers> = {
    type: "box",
    class: {
        name: "AudioWarpingBox",
        fields: {
            10: {
                type: "field", name: "warp-markers",
                pointerRules: {accepts: [Pointers.WarpMarkers], mandatory: true}
            },
            11: {
                type: "field", name: "transient-markers",
                pointerRules: {accepts: [Pointers.TransientMarkers], mandatory: false}
            }
        }
    }, pointerRules: {accepts: [Pointers.AudioWarping], mandatory: true}
}