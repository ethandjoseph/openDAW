import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"
import {DefaultParameterPointerRules} from "../../defaults"
import {createAudioEffectDevice} from "../builder"

export const FoldDeviceBox: BoxSchema<Pointers> = createAudioEffectDevice("FoldDeviceBox", {
    10: {type: "float32", name: "drive", pointerRules: DefaultParameterPointerRules, value: 0.0},
    11: {type: "int32", name: "over-sampling", value: 0},
    12: {type: "float32", name: "volume", pointerRules: DefaultParameterPointerRules, value: 0.0}
})