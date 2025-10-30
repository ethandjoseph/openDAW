import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"
import {DeviceFactory} from "../../std/DeviceFactory"

export const MIDIOutputDeviceBox: BoxSchema<Pointers> = DeviceFactory.createInstrument("MIDIOutputDeviceBox", {
    10: {
        // TODO deprecated. Use pointer (14) instead
        type: "object", name: "deprecated-device", class: {
            name: "Device",
            fields: {
                1: {type: "string", name: "id"},
                2: {type: "string", name: "label"}
            }
        }
    },
    11: {type: "int32", name: "channel"},
    12: {type: "int32", name: "deprecated-delay", value: 10}, // TODO deprecated. Now in MIDIOutputBox
    13: {type: "field", name: "parameters", pointerRules: {accepts: [Pointers.Parameter], mandatory: false}},
    14: {type: "pointer", name: "device", pointerType: Pointers.MIDIDevice, mandatory: false}
})