import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"

export const AudioWarpingBox: BoxSchema<Pointers> = {
    type: "box",
    class: {
        name: "AudioWarpingBox",
        fields: {
            11: {
                type: "field", name: "warp-markers",
                pointerRules: {accepts: [Pointers.WarpMarkers], mandatory: true}
            },
            12: {
                type: "field", name: "transient-markers",
                pointerRules: {accepts: [Pointers.TransientMarkers], mandatory: false}
            },
            21: {type: "bytes", name: "wraps", value: new Int8Array([1])},
            22: {type: "bytes", name: "transients", value: new Int8Array([1])}
        }
    }, pointerRules: {accepts: [Pointers.AudioWarping], mandatory: true}
}