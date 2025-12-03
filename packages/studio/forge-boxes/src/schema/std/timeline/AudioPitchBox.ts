import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"

export const AudioPitchBox: BoxSchema<Pointers> = {
    type: "box",
    class: {
        name: "AudioPitchBox",
        fields: {
            1: {
                type: "field", name: "warp-markers", pointerRules: {accepts: [Pointers.WarpMarkers], mandatory: true}
            }
        }
    }, pointerRules: {accepts: [Pointers.AudioPlayMode], mandatory: true}
}