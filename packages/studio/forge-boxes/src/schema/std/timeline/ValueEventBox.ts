import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"

export const ValueEventBox: BoxSchema<Pointers> = {
    type: "box",
    class: {
        name: "ValueEventBox",
        fields: {
            1: {type: "pointer", name: "events", pointerType: Pointers.ValueEvents, mandatory: true},
            10: {type: "int32", name: "position"},
            11: {type: "int32", name: "index"},
            12: {
                type: "int32",
                name: "interpolation",
                value: 1 /* default is linear */,
                pointerRules: {accepts: [Pointers.ValueInterpolation], mandatory: false}
            },
            13: {type: "float32", name: "value"},
            // TODO Remove slope. It is not used anymore but older project files
            14: {type: "float32", name: "slope"}
        }
    }, pointerRules: {accepts: [Pointers.Selection], mandatory: false}
}