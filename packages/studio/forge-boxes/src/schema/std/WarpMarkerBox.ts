import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"

export const WarpMarkerBox: BoxSchema<Pointers> = {
    type: "box",
    class: {
        name: "WarpMarkerBox",
        fields: {
            1: {type: "pointer", name: "owner", pointerType: Pointers.WarpMarkers, mandatory: true},
            2: {type: "float32", name: "position", constraints: "non-negative", unit: "seconds"},
            3: {type: "float32", name: "time", constraints: "any", unit: "ppqn"}
        }
    }, pointerRules: {accepts: [Pointers.Selection], mandatory: true}
}