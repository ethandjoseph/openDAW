import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"
import {DefaultParameterPointerRules} from "./defaults"

export const UnitParameterBox: BoxSchema<Pointers> = {
    type: "box",
    class: {
        name: "UnitParameterBox",
        fields: {
            1: {type: "pointer", name: "owner", pointerType: Pointers.Parameter, mandatory: true},
            2: {type: "float32", name: "value", pointerRules: DefaultParameterPointerRules}
        }
    }
}