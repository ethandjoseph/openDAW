import {Voice} from "../../voicing/Voice"
import {
    Adsr,
    AudioBuffer,
    BandLimitedOscillator,
    BiquadCoeff,
    Glide,
    ModulatedBiquad,
    ppqn,
    RenderQuantum,
    SILENCE_THRESHOLD,
    Smooth,
    StereoMatrix,
    velocityToGain
} from "@opendaw/lib-dsp"
import {int, unitValue} from "@opendaw/lib-std"
import {Block} from "../../processing"
import {VaporisateurDeviceProcessor} from "./VaporisateurDeviceProcessor"

// We can do this because there is no multi-threading within the processor
const oscBuffer = new Float32Array(RenderQuantum)
const envBuffer = new Float32Array(RenderQuantum)
const freqBuffer = new Float32Array(RenderQuantum)
const cutoffBuffer = new Float32Array(RenderQuantum)

export class VaporisateurVoice implements Voice {
    readonly device: VaporisateurDeviceProcessor
    readonly osc: BandLimitedOscillator
    readonly filterCoeff: BiquadCoeff
    readonly filter: ModulatedBiquad
    readonly env: Adsr
    readonly glide: Glide
    readonly gainSmooth: Smooth

    id: int = -1
    velocity: unitValue = 0.0
    panning: number = 0.0
    phase: number = 0.0
    lfoPhase: number = 0.0

    constructor(device: VaporisateurDeviceProcessor) {
        this.device = device

        this.osc = new BandLimitedOscillator(sampleRate)
        this.filterCoeff = new BiquadCoeff()
        this.filter = new ModulatedBiquad(20.0, 20000.0, sampleRate)
        this.filter.order = 1
        this.env = new Adsr(sampleRate)
        this.env.set(this.device.env_attack, this.device.env_decay, this.device.env_sustain, this.device.env_release)
        this.env.gateOn()
        this.glide = new Glide()
        this.gainSmooth = new Smooth(0.003, sampleRate)
    }

    start(id: int, frequency: number, velocity: unitValue, panning: number = 0.0): void {
        this.id = id
        this.velocity = velocity
        this.panning = panning
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
        const gain = velocityToGain(this.velocity) * this.device.gain
        const waveform = this.device.osc_waveform
        const cutoffMapping = this.device.adapter.namedParameter.cutoff.valueMapping
        const cutoffBase = cutoffMapping.x(this.device.flt_cutoff)
        const resonance = this.device.flt_resonance
        const filterEnvelope = this.device.flt_env_amount
        const [gainL, gainR] = StereoMatrix.panningToGains(this.panning, StereoMatrix.Mixing.Linear)
        const [outL, outR] = output.channels()

        this.glide.process(freqBuffer, bpm, fromIndex, toIndex)
        this.osc.generateFromFrequencies(oscBuffer, freqBuffer, waveform, fromIndex, toIndex)
        this.env.process(envBuffer, fromIndex, toIndex)

        for (let i = fromIndex; i < toIndex; i++) {
            cutoffBuffer[i] = cutoffBase + envBuffer[i] * filterEnvelope
            this.lfoPhase += 0.001
        }

        this.filter.process(oscBuffer, oscBuffer, cutoffBuffer, resonance, fromIndex, toIndex)

        for (let i = fromIndex; i < toIndex; i++) {
            const vca = this.gainSmooth.process(envBuffer[i] * gain)
            const amp = oscBuffer[i] * vca
            outL[i] += amp * gainL
            outR[i] += amp * gainR
            if (this.env.complete && this.gainSmooth.value < SILENCE_THRESHOLD) {return true}
        }
        return false
    }
}