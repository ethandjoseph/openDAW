import {StringMapping, UUID, ValueMapping} from "@opendaw/lib-std"
import {VaporisateurDeviceBox} from "@opendaw/studio-boxes"
import {Address, BooleanField, StringField} from "@opendaw/lib-box"
import {DeviceHost, Devices, InstrumentDeviceBoxAdapter} from "../../DeviceAdapter"
import {BoxAdaptersContext} from "../../BoxAdaptersContext"
import {ParameterAdapterSet} from "../../ParameterAdapterSet"
import {TrackType} from "../../timeline/TrackType"
import {AudioUnitBoxAdapter} from "../../audio-unit/AudioUnitBoxAdapter"
import {VoicingMode} from "@opendaw/studio-enums"
import {Vaporisateur} from "./Vaporisateur"

export class VaporisateurDeviceBoxAdapter implements InstrumentDeviceBoxAdapter {
    readonly type = "instrument"
    readonly accepts = "midi"

    readonly #context: BoxAdaptersContext
    readonly #box: VaporisateurDeviceBox

    readonly #parametric: ParameterAdapterSet
    readonly namedParameter // let typescript infer the type

    constructor(context: BoxAdaptersContext, box: VaporisateurDeviceBox) {
        this.#context = context
        this.#box = box
        this.#parametric = new ParameterAdapterSet(this.#context)
        this.namedParameter = this.#wrapParameters(box)
    }

    get box(): VaporisateurDeviceBox {return this.#box}
    get uuid(): UUID.Bytes {return this.#box.address.uuid}
    get address(): Address {return this.#box.address}
    get labelField(): StringField {return this.#box.label}
    get iconField(): StringField {return this.#box.icon}
    get defaultTrackType(): TrackType {return TrackType.Notes}
    get enabledField(): BooleanField {return this.#box.enabled}
    get minimizedField(): BooleanField {return this.#box.minimized}
    get acceptsMidiEvents(): boolean {return true}

    deviceHost(): DeviceHost {
        return this.#context.boxAdapters
            .adapterFor(this.#box.host.targetVertex.unwrap("no device-host").box, Devices.isHost)
    }

    audioUnitBoxAdapter(): AudioUnitBoxAdapter {return this.deviceHost().audioUnitBoxAdapter()}

    terminate(): void {this.#parametric.terminate()}

    #wrapParameters(box: VaporisateurDeviceBox) {
        const VoiceModes = [VoicingMode.Monophonic, VoicingMode.Polyphonic]
        return {
            volume: this.#parametric.createParameter(
                box.volume,
                ValueMapping.DefaultDecibel,
                StringMapping.numeric({unit: "db", fractionDigits: 1}), "Volume"),
            octave: this.#parametric.createParameter(
                box.octave,
                ValueMapping.linearInteger(-3, 3),
                StringMapping.numeric(), "Octave", 0.5),
            tune: this.#parametric.createParameter(
                box.tune,
                ValueMapping.linear(-1200.0, +1200.0),
                StringMapping.numeric({unit: "Cent", fractionDigits: 0}), "tune", 0.5),
            waveform: this.#parametric.createParameter(
                box.waveform,
                ValueMapping.linearInteger(0, 3),
                StringMapping.indices("", ["Sine", "Triangle", "Sawtooth", "Square"]), "Waveform"),
            cutoff: this.#parametric.createParameter(
                box.cutoff,
                Vaporisateur.CUTOFF_VALUE_MAPPING,
                Vaporisateur.CUTOFF_STRING_MAPPING, "Cutoff"),
            resonance: this.#parametric.createParameter(
                box.resonance,
                ValueMapping.exponential(0.01, 10.0),
                StringMapping.numeric({unit: "q", fractionDigits: 3}), "Resonance"),
            attack: this.#parametric.createParameter(
                box.attack,
                ValueMapping.exponential(0.001, 5.0),
                StringMapping.numeric({unit: "s", fractionDigits: 3}), "Attack"),
            decay: this.#parametric.createParameter(
                box.decay,
                ValueMapping.exponential(0.001, 5.0),
                StringMapping.numeric({unit: "s", fractionDigits: 3}), "Decay"),
            sustain: this.#parametric.createParameter(
                box.sustain,
                ValueMapping.unipolar(),
                StringMapping.percent({fractionDigits: 1}), "Sustain"),
            release: this.#parametric.createParameter(
                box.release,
                ValueMapping.exponential(0.001, 5.0),
                StringMapping.numeric({unit: "s", fractionDigits: 3}), "Release"),
            filterEnvelope: this.#parametric.createParameter(
                box.filterEnvelope,
                ValueMapping.linear(-1.0, 1.0),
                StringMapping.percent(), "Filter env", 0.5),
            voicingMode: this.#parametric.createParameter(
                box.voicingMode,
                ValueMapping.values(VoiceModes),
                StringMapping.values("", VoiceModes, ["mono", "poly"]), "Play Mode", 0.5),
            glideTime: this.#parametric.createParameter(
                box.glideTime,
                ValueMapping.unipolar(),
                StringMapping.percent({fractionDigits: 1}), "Glide time", 0.0),
            unisonCount: this.#parametric.createParameter(
                box.unisonCount,
                ValueMapping.values([1, 3, 5]),
                StringMapping.values("#", [1, 3, 5], [1, 3, 5].map(x => String(x))), "Unisono", 0.0),
            unisonDetune: this.#parametric.createParameter(
                box.unisonDetune,
                ValueMapping.exponential(1.0, 1200.0),
                StringMapping.numeric({unit: "ct", fractionDigits: 0}), "Uni. Detune", 0.0)
        } as const
    }
}