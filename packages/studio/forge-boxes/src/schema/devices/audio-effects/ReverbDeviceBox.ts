import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"
import {DefaultParameterPointerRules} from "../../std/Defaults"
import {DeviceFactory} from "../../std/DeviceFactory"

export const ReverbDeviceBox: BoxSchema<Pointers> = DeviceFactory.createAudioEffect("ReverbDeviceBox", {
    10: {type: "float32", name: "decay", pointerRules: DefaultParameterPointerRules, value: 0.5},
    11: {type: "float32", name: "pre-delay", pointerRules: DefaultParameterPointerRules, value: 0.0},
    12: {type: "float32", name: "damp", pointerRules: DefaultParameterPointerRules, value: 0.5},
    13: {type: "float32", name: "filter", pointerRules: DefaultParameterPointerRules, value: 0.0},
    14: {type: "float32", name: "wet", pointerRules: DefaultParameterPointerRules, value: -3.0},
    15: {type: "float32", name: "dry", pointerRules: DefaultParameterPointerRules, value: 0.0}
})