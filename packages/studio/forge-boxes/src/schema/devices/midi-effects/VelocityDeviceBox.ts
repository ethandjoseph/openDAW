import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"
import {DefaultParameterPointerRules} from "../../std/Defaults"
import {DeviceFactory} from "../../std/DeviceFactory"

export const VelocityDeviceBox: BoxSchema<Pointers> = DeviceFactory.createMidiEffect("VelocityDeviceBox", {
    10: {type: "float32", name: "magnet-position", pointerRules: DefaultParameterPointerRules, value: 0.5},
    11: {type: "float32", name: "magnet-strength", pointerRules: DefaultParameterPointerRules},
    12: {type: "int32", name: "random-seed", value: 0x800},
    13: {type: "float32", name: "random-amount", pointerRules: DefaultParameterPointerRules},
    14: {type: "float32", name: "offset", pointerRules: DefaultParameterPointerRules},
    15: {type: "float32", name: "mix", pointerRules: DefaultParameterPointerRules, value: 1.0}
})