import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"
import {DefaultParameterPointerRules} from "../../defaults"
import {createAudioEffectDevice} from "../builder"

export const FoldDeviceBox: BoxSchema<Pointers> = createAudioEffectDevice("FoldDeviceBox", {
    10: {type: "float32", name: "amount", pointerRules: DefaultParameterPointerRules, value: 1.0}
})