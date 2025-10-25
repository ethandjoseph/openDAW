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
    12: {type: "int32", name: "delay", value: 10},
    13: {type: "field", name: "parameters", pointerRules: {accepts: [Pointers.Parameter], mandatory: false}}
})

export const MIDIOutputParameterBox: BoxSchema<Pointers> = {
    type: "box",
    class: {
        name: "MIDIOutputParameterBox",
        fields: {
            1: {type: "pointer", name: "owner", pointerType: Pointers.Parameter, mandatory: true},
            2: {type: "string", name: "label", value: ""},
            3: {type: "int32", name: "controller"},
            4: {
                type: "int32", name: "value", pointerRules: {
                    accepts: [Pointers.Modulation, Pointers.Automation, Pointers.MidiControl],
                    mandatory: true
                }
            }
        }
    }
}