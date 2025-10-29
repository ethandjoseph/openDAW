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

export const MIDIOutputBox: BoxSchema<Pointers> = {
    type: "box",
    class: {
        name: "MIDIOutputBox",
        fields: {
            1: {type: "pointer", name: "root", pointerType: Pointers.MIDIDevice, mandatory: true},
            2: {type: "field", name: "device", pointerRules: {accepts: [Pointers.MIDIDevice], mandatory: true}},
            3: {type: "string", name: "id"},
            4: {type: "string", name: "label"},
            5: {type: "int32", name: "delayInMs", value: 10},
            6: {type: "boolean", name: "send-transport-messages"}
        }
    }
}

export const MIDIOutputParameterBox: BoxSchema<Pointers> = {
    type: "box",
    class: {
        name: "MIDIOutputParameterBox",
        fields: {
            1: {type: "pointer", name: "owner", pointerType: Pointers.Parameter, mandatory: true},
            2: {type: "string", name: "label", value: ""},
            3: {type: "int32", name: "controller", value: 64},
            4: {
                type: "float32", name: "value", pointerRules: {
                    accepts: [Pointers.Modulation, Pointers.Automation, Pointers.MidiControl],
                    mandatory: true
                }
            }
        }
    }
}