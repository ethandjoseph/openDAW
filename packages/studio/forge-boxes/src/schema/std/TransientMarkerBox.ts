import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"

export const TransientMarkerBox: BoxSchema<Pointers> = {
    type: "box",
    class: {
        name: "TransientMarkerBox",
        fields: {
            1: {type: "pointer", name: "owner", pointerType: Pointers.TransientMarkers, mandatory: true},
            2: {type: "float32", name: "position", constraints: "non-negative", unit: "seconds"},
            3: {type: "float32", name: "energy", constraints: "non-negative", unit: "gain"}
        }
    }, pointerRules: {accepts: [Pointers.Selection], mandatory: false}
}