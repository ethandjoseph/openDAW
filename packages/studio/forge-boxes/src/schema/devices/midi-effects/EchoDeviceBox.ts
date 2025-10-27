import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"
import {DefaultParameterPointerRules} from "../../std/Defaults"
import {DeviceFactory} from "../../std/DeviceFactory"

export const EchoDeviceBox: BoxSchema<Pointers> = DeviceFactory.createMidiEffect("EchoDeviceBox", {
    10: {type: "float32", name: "rate", pointerRules: DefaultParameterPointerRules},
    11: {type: "boolean", name: "sync", pointerRules: DefaultParameterPointerRules},
    12: {type: "float32", name: "feedback", pointerRules: DefaultParameterPointerRules},
    13: {type: "float32", name: "velocity", pointerRules: DefaultParameterPointerRules}
})