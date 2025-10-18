import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"
import {DefaultParameterPointerRules} from "../../defaults"
import {createAudioEffectDevice} from "../builder"

export const CrusherDeviceBox: BoxSchema<Pointers> = createAudioEffectDevice("CrusherDeviceBox", {
    10: {type: "float32", name: "crush", pointerRules: DefaultParameterPointerRules, value: 0.0},
    11: {type: "int32", name: "bits", pointerRules: DefaultParameterPointerRules, value: 16},
    12: {type: "float32", name: "boost", pointerRules: DefaultParameterPointerRules, value: 0.0},
    13: {type: "float32", name: "mix", pointerRules: DefaultParameterPointerRules, value: 1.0}
})