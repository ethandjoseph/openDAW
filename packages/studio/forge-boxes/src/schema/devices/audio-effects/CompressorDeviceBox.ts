import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"
import {DeviceFactory} from "../../std/DeviceFactory"
import {DefaultParameterPointerRules} from "../../std/Defaults"

// Ported from https://github.com/p-hlp/CTAGDRC

export const CompressorDeviceBox: BoxSchema<Pointers> = DeviceFactory.createAudioEffect("CompressorDeviceBox", {
    10: {type: "boolean", name: "lookahead", pointerRules: DefaultParameterPointerRules, value: false},
    11: {type: "boolean", name: "automakeup", pointerRules: DefaultParameterPointerRules, value: true},
    12: {type: "boolean", name: "autoattack", pointerRules: DefaultParameterPointerRules, value: false},
    13: {type: "boolean", name: "autorelease", pointerRules: DefaultParameterPointerRules, value: false},
    14: {type: "float32", name: "inputgain", pointerRules: DefaultParameterPointerRules, value: 0.0}, // Range: -30.0 to 30.0 dB
    15: {type: "float32", name: "threshold", pointerRules: DefaultParameterPointerRules, value: -10.0}, // Range: -60.0 to 0.0 dB
    16: {type: "float32", name: "ratio", pointerRules: DefaultParameterPointerRules, value: 2.0}, // Range: 1.0 to 24.0 (1:1 to infinity: 1)
    17: {type: "float32", name: "knee", pointerRules: DefaultParameterPointerRules, value: 0.0}, // Range: 0.0 to 24.0 dB
    18: {type: "float32", name: "attack", pointerRules: DefaultParameterPointerRules, value: 0.0}, // Range: 0.0 to 100.0 ms
    19: {type: "float32", name: "release", pointerRules: DefaultParameterPointerRules, value: 5.0}, // Range: 5.0 to 1500.0 ms
    20: {type: "float32", name: "makeup", pointerRules: DefaultParameterPointerRules, value: 0.0}, // Range: -40.0 to 40.0 dB
    21: {type: "float32", name: "mix", pointerRules: DefaultParameterPointerRules, value: 1.0} // Range: 0.0 to 1.0 (0% to 100%)
})