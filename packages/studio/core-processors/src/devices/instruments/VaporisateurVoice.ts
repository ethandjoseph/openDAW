import {Voice} from "../../voicing/Voice"
import {
    Adsr,
    AudioBuffer,
    BandLimitedOscillator,
    BiquadCoeff,
    BiquadMono,
    Glide,
    ppqn,
    RenderQuantum,
    Smooth,
    StereoMatrix,
    velocityToGain
} from "@opendaw/lib-dsp"
import {clamp, int, unitValue} from "@opendaw/lib-std"
import {Block} from "../../processing"
import {VaporisateurDeviceProcessor} from "./VaporisateurDeviceProcessor"

export class VaporisateurVoice implements Voice {
    readonly device: VaporisateurDeviceProcessor
    readonly osc: BandLimitedOscillator
    readonly oscBuffer: Float32Array
    readonly filterCoeff: BiquadCoeff
    readonly filterProcessor: BiquadMono
    readonly env: Adsr
    readonly envBuffer: Float32Array
    readonly freqBuffer: Float32Array
    readonly glide: Glide
    readonly gainSmooth: Smooth

    id: int = -1
    velocity: unitValue = 0.0
    panning: number = 0.0

    phase: number = 0.0

    constructor(device: VaporisateurDeviceProcessor) {
        this.device = device

        this.osc = new BandLimitedOscillator(sampleRate)
        this.oscBuffer = new Float32Array(RenderQuantum)
        this.envBuffer = new Float32Array(RenderQuantum)
        this.freqBuffer = new Float32Array(RenderQuantum)
        this.filterCoeff = new BiquadCoeff()
        this.filterProcessor = new BiquadMono()
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
        const invSampleRate = 1.0 / sampleRate
        const resonance = this.device.flt_resonance
        const filterEnvelope = this.device.flt_env_amount
        const [gainL, gainR] = StereoMatrix.panningToGains(this.panning, StereoMatrix.Mixing.Linear)
        const [outL, outR] = output.channels()

        this.glide.process(this.freqBuffer, bpm, fromIndex, toIndex)
        this.osc.generateFromFrequencies(this.oscBuffer, this.freqBuffer, waveform, fromIndex, toIndex)
        this.env.process(this.envBuffer, fromIndex, toIndex)
        for (let i = fromIndex; i < toIndex; i++) {
            const vca = this.gainSmooth.process(this.envBuffer[i] * gain)
            const cutoff = cutoffMapping.y(clamp(cutoffBase + this.envBuffer[i] * filterEnvelope, 0.0, 1.0))
            this.filterCoeff.setLowpassParams(cutoff * invSampleRate, resonance)
            const amp = this.filterProcessor.processFrame(this.filterCoeff, this.oscBuffer[i]) * vca
            outL[i] += amp * gainL
            outR[i] += amp * gainR
            if (this.env.complete && this.gainSmooth.value < 1e-6) {return true}
        }
        return false
    }
}