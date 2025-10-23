import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"
import {createInstrumentDevice} from "../builder"

export const MIDIOutputDeviceBox: BoxSchema<Pointers> = createInstrumentDevice("MIDIOutputDeviceBox", {
    10: {
        type: "object", name: "device", class: {
            name: "Device",
            fields: {
                1: {type: "string", name: "id"},
                2: {type: "string", name: "label"}
            }
        }
    },
    11: {type: "int32", name: "channel"},
    12: {type: "int32", name: "delay"}
})