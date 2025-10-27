import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"
import {DefaultParameterPointerRules} from "../../std/Defaults"
import {DeviceFactory} from "../../std/DeviceFactory"

export const TapeDeviceBox: BoxSchema<Pointers> = DeviceFactory.createInstrument("TapeDeviceBox", {
    10: {type: "float32", name: "flutter", pointerRules: DefaultParameterPointerRules},
    11: {type: "float32", name: "wow", pointerRules: DefaultParameterPointerRules},
    12: {type: "float32", name: "noise", pointerRules: DefaultParameterPointerRules},
    13: {type: "float32", name: "saturation", pointerRules: DefaultParameterPointerRules}
}, Pointers.Automation)