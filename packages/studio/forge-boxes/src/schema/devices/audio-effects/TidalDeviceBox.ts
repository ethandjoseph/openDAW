import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"
import {DeviceFactory} from "../../std/DeviceFactory"
import {DefaultParameterPointerRules} from "../../std/Defaults"

export const TidalDeviceBox: BoxSchema<Pointers> = DeviceFactory.createAudioEffect("TidalDeviceBox", {
    10: {type: "float32", name: "slope", pointerRules: DefaultParameterPointerRules, value: -0.25},
    11: {type: "float32", name: "symmetry", pointerRules: DefaultParameterPointerRules, value: 0.5},
    20: {type: "float32", name: "rate", pointerRules: DefaultParameterPointerRules, value: 3},
    21: {type: "float32", name: "depth", pointerRules: DefaultParameterPointerRules, value: 1.0},
    22: {type: "float32", name: "offset", pointerRules: DefaultParameterPointerRules, value: 0.0},
    23: {type: "float32", name: "channel-offset", pointerRules: DefaultParameterPointerRules, value: 0.0}
})