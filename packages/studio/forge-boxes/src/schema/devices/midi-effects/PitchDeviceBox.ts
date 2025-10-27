import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"
import {DefaultParameterPointerRules} from "../../std/Defaults"
import {DeviceFactory} from "../../std/DeviceFactory"

export const PitchDeviceBox: BoxSchema<Pointers> = DeviceFactory.createMidiEffect("PitchDeviceBox", {
    10: {type: "int32", name: "semi-tones", pointerRules: DefaultParameterPointerRules},
    11: {type: "float32", name: "cents", pointerRules: DefaultParameterPointerRules},
    12: {type: "int32", name: "octaves", pointerRules: DefaultParameterPointerRules}
})