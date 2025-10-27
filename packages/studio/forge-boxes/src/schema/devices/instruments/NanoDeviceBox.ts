import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"
import {DefaultParameterPointerRules} from "../../std/Defaults"
import {DeviceFactory} from "../../std/DeviceFactory"

export const NanoDeviceBox: BoxSchema<Pointers> = DeviceFactory.createInstrument("NanoDeviceBox", {
    10: {type: "float32", name: "volume", pointerRules: DefaultParameterPointerRules, value: -3.0},
    15: {type: "pointer", name: "file", pointerType: Pointers.AudioFile, mandatory: false},
    20: {type: "float32", name: "release", pointerRules: DefaultParameterPointerRules, value: 0.1}
})