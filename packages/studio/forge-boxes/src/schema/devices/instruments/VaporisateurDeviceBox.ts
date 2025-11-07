import {BoxSchema, deprecated} from "@opendaw/lib-box-forge"
import {Pointers, VoicingMode} from "@opendaw/studio-enums"
import {DefaultParameterPointerRules} from "../../std/Defaults"
import {DeviceFactory} from "../../std/DeviceFactory"

export const VaporisateurDeviceBox: BoxSchema<Pointers> = DeviceFactory.createInstrument("VaporisateurDeviceBox", {
    10: {type: "float32", name: "volume", deprecated, pointerRules: DefaultParameterPointerRules, value: -6.0},
    11: {type: "int32", name: "octave", deprecated, pointerRules: DefaultParameterPointerRules},
    12: {type: "float32", name: "tune", deprecated, pointerRules: DefaultParameterPointerRules},
    13: {type: "int32", name: "waveform", deprecated, pointerRules: DefaultParameterPointerRules},
    14: {type: "float32", name: "cutoff", pointerRules: DefaultParameterPointerRules},
    15: {type: "float32", name: "resonance", pointerRules: DefaultParameterPointerRules},
    16: {type: "float32", name: "attack", pointerRules: DefaultParameterPointerRules},
    17: {type: "float32", name: "release", pointerRules: DefaultParameterPointerRules},
    18: {type: "float32", name: "filter-envelope", pointerRules: DefaultParameterPointerRules},
    19: {type: "float32", name: "decay", pointerRules: DefaultParameterPointerRules, value: 0.001},
    20: {type: "float32", name: "sustain", pointerRules: DefaultParameterPointerRules, value: 1.0},
    21: {type: "float32", name: "glide-time", pointerRules: DefaultParameterPointerRules, value: 0.0},
    22: {
        type: "int32",
        name: "voicing-mode",
        pointerRules: DefaultParameterPointerRules,
        value: VoicingMode.Polyphonic
    },
    23: {type: "int32", name: "unison-count", pointerRules: DefaultParameterPointerRules, value: 1},
    24: {type: "float32", name: "unison-detune", pointerRules: DefaultParameterPointerRules, value: 30},
    25: {type: "float32", name: "unison-stereo", pointerRules: DefaultParameterPointerRules, value: 1.0},
    26: {type: "int32", name: "filter-order", pointerRules: DefaultParameterPointerRules, value: 1},
    27: {type: "float32", name: "filter-keyboard", pointerRules: DefaultParameterPointerRules},
    30: {
        type: "object", name: "lfo", class: {
            name: "VaporisateurLFO",
            fields: {
                1: {type: "int32", name: "waveform", pointerRules: DefaultParameterPointerRules},
                2: {type: "float32", name: "rate", pointerRules: DefaultParameterPointerRules, value: 0},
                3: {type: "boolean", name: "sync", pointerRules: DefaultParameterPointerRules, value: false},
                10: {type: "float32", name: "target-tune", pointerRules: DefaultParameterPointerRules},
                11: {type: "float32", name: "target-cutoff", pointerRules: DefaultParameterPointerRules},
                12: {type: "float32", name: "target-volume", pointerRules: DefaultParameterPointerRules}
            }
        }
    },
    40: {
        type: "array", name: "oscillators", length: 2, element: {
            type: "object", name: "osc", class: {
                name: "VaporisateurOsc",
                fields: {
                    1: {type: "int32", name: "waveform", pointerRules: DefaultParameterPointerRules},
                    2: {type: "float32", name: "volume", pointerRules: DefaultParameterPointerRules, value: 0.0},
                    3: {type: "int32", name: "octave", pointerRules: DefaultParameterPointerRules, value: 0},
                    4: {type: "float32", name: "tune", pointerRules: DefaultParameterPointerRules}
                }
            }
        }
    },
    99: {type: "int32", name: "version"}
})