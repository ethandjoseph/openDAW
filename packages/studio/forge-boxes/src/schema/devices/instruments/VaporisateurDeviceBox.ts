import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers, VoicingMode} from "@opendaw/studio-enums"
import {DefaultParameterPointerRules} from "../../std/Defaults"
import {DeviceFactory} from "../../std/DeviceFactory"

export const VaporisateurDeviceBox: BoxSchema<Pointers> = DeviceFactory.createInstrument("VaporisateurDeviceBox", {
    10: {type: "float32", name: "volume", pointerRules: DefaultParameterPointerRules},
    11: {type: "int32", name: "octave", pointerRules: DefaultParameterPointerRules},
    12: {type: "float32", name: "tune", pointerRules: DefaultParameterPointerRules},
    13: {type: "int32", name: "waveform", pointerRules: DefaultParameterPointerRules},
    14: {type: "float32", name: "cutoff", pointerRules: DefaultParameterPointerRules},
    15: {type: "float32", name: "resonance", pointerRules: DefaultParameterPointerRules},
    16: {type: "float32", name: "attack", pointerRules: DefaultParameterPointerRules},
    17: {type: "float32", name: "release", pointerRules: DefaultParameterPointerRules},
    18: {type: "float32", name: "filter-envelope", pointerRules: DefaultParameterPointerRules},
    19: {type: "float32", name: "decay", pointerRules: DefaultParameterPointerRules, value: 0.001},
    20: {type: "float32", name: "sustain", pointerRules: DefaultParameterPointerRules, value: 1.0},
    21: {type: "float32", name: "glide-time", pointerRules: DefaultParameterPointerRules, value: 0.0},
    22: {type: "int32", name: "play-mode", value: VoicingMode.Polyphonic}
})