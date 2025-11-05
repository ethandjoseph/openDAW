import {
    Adsr,
    AudioBuffer,
    BandLimitedOscillator,
    Glide,
    LFO,
    MidiKeys,
    ModulatedBiquad,
    ppqn,
    RenderQuantum,
    SILENCE_THRESHOLD,
    Smooth,
    StereoMatrix,
    velocityToGain
} from "@opendaw/lib-dsp"
import {Arrays, byte, clampUnit, int, unitValue} from "@opendaw/lib-std"
import {Voice} from "../../voicing/Voice"
import {Block} from "../../processing"
import {Vaporisateur} from "@opendaw/studio-adapters"
import {VaporisateurDeviceProcessor} from "./VaporisateurDeviceProcessor"

// We can do this because there is no multi-threading within the processor
const [
    outBuffer, vcaBuffer, lfoBuffer, freqBuffer, cutoffBuffer
] = Arrays.create(() => new Float32Array(RenderQuantum), 5)

export class VaporisateurVoice implements Voice {
    readonly device: VaporisateurDeviceProcessor
    readonly osc: BandLimitedOscillator
    readonly lfo: LFO
    readonly filter: ModulatedBiquad
    readonly env: Adsr
    readonly glide: Glide
    readonly gainSmooth: Smooth

    id: int = -1
    velocity: unitValue = 0.0
    panning: number = 0.0
    gain: number = 1.0
    phase: number = 0.0
    filter_keyboard_delta: number = 0.0

    constructor(device: VaporisateurDeviceProcessor) {
        this.device = device

        this.osc = new BandLimitedOscillator(sampleRate)
        this.lfo = new LFO(sampleRate)
        this.filter = new ModulatedBiquad(Vaporisateur.MIN_CUTOFF, Vaporisateur.MAX_CUTOFF, sampleRate)
        this.filter.order = 1
        this.env = new Adsr(sampleRate)
        this.env.set(this.device.env_attack, this.device.env_decay, this.device.env_sustain, this.device.env_release)
        this.env.gateOn()
        this.glide = new Glide()
        this.gainSmooth = new Smooth(0.003, sampleRate)
    }

    start(id: int, baseNote: byte, frequency: number, velocity: unitValue, gain: number, panning: number): void {
        this.id = id
        this.velocity = velocity
        this.gain = gain
        this.panning = panning
        this.filter_keyboard_delta = MidiKeys.keyboardTracking(baseNote, this.device.parameterFilterKeyboard.getValue())
        this.glide.start(frequency)
    }

    stop(): void {this.env.gateOff()}

    forceStop(): void {this.env.forceStop()}

    startGlide(targetFrequency: number, glideDuration: ppqn): void {
        this.glide.glideTo(targetFrequency, glideDuration)
    }

    get gate(): boolean {return this.env.gate}
    get currentFrequency(): number {return this.glide.currentFrequency()}

    process(output: AudioBuffer, {bpm}: Block, fromIndex: int, toIndex: int): boolean {
        const {
            gain: deviceGain,
            osc_waveform,
            flt_cutoff,
            flt_resonance,
            flt_env_amount,
            flt_order,
            frequencyMultiplier,
            parameterLfoShape,
            parameterLfoRate,
            parameterLfoTargetTune,
            parameterLfoTargetCutoff,
            parameterLfoTargetVolume
        } = this.device
        const gain = velocityToGain(this.velocity) * this.gain * deviceGain
        const [gainL, gainR] = StereoMatrix.panningToGains(this.panning, StereoMatrix.Mixing.Linear)
        const [outL, outR] = output.channels()

        freqBuffer.fill(frequencyMultiplier, fromIndex, toIndex)
        this.glide.process(freqBuffer, bpm, fromIndex, toIndex)
        this.lfo.fill(lfoBuffer, parameterLfoShape.getValue(), parameterLfoRate.getValue(), fromIndex, toIndex)
        this.env.process(vcaBuffer, fromIndex, toIndex)

        const lfo_target_tune = parameterLfoTargetTune.getValue()
        const lfo_target_cutoff = parameterLfoTargetCutoff.getValue()
        const lfo_target_volume = parameterLfoTargetVolume.getValue()

        // apply lfo
        for (let i = fromIndex; i < toIndex; i++) {
            const lfo = lfoBuffer[i]
            vcaBuffer[i] += lfo * lfo_target_volume
            cutoffBuffer[i] = flt_cutoff
                + this.filter_keyboard_delta
                + vcaBuffer[i] * flt_env_amount
                + lfo * lfo_target_cutoff
            freqBuffer[i] *= 2.0 ** (lfo * lfo_target_tune)
        }

        this.osc.generateFromFrequencies(outBuffer, freqBuffer, osc_waveform, fromIndex, toIndex)

        this.filter.order = flt_order
        this.filter.process(outBuffer, outBuffer, cutoffBuffer, flt_resonance, fromIndex, toIndex)

        for (let i = fromIndex; i < toIndex; i++) {
            const vca = this.gainSmooth.process(clampUnit(vcaBuffer[i] * gain))
            const out = outBuffer[i] * vca
            outL[i] += out * gainL
            outR[i] += out * gainR
            if (this.env.complete && vca < SILENCE_THRESHOLD) {return true}
        }
        return false
    }
}