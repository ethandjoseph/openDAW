import {
    Adsr,
    AudioBuffer,
    BandLimitedOscillator,
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
import {Voice} from "../../voicing/Voice"
import {Block} from "../../processing"
import {Vaporisateur} from "@opendaw/studio-adapters"
import {VaporisateurDeviceProcessor} from "./VaporisateurDeviceProcessor"

// We can do this because there is no multi-threading within the processor
const oscBuffer = new Float32Array(RenderQuantum)
const envBuffer = new Float32Array(RenderQuantum)
const freqBuffer = new Float32Array(RenderQuantum)
const cutoffBuffer = new Float32Array(RenderQuantum)

export class VaporisateurVoice implements Voice {
    readonly device: VaporisateurDeviceProcessor
    readonly osc: BandLimitedOscillator
    readonly filter: ModulatedBiquad
    readonly env: Adsr
    readonly glide: Glide
    readonly gainSmooth: Smooth

    id: int = -1
    velocity: unitValue = 0.0
    panning: number = 0.0
    gain: number = 1.0
    phase: number = 0.0
    lfoPhase: number = 0.0

    constructor(device: VaporisateurDeviceProcessor) {
        this.device = device

        this.osc = new BandLimitedOscillator(sampleRate)
        this.filter = new ModulatedBiquad(Vaporisateur.MIN_CUTOFF, Vaporisateur.MAX_CUTOFF, sampleRate)
        this.filter.order = 1
        this.env = new Adsr(sampleRate)
        this.env.set(this.device.env_attack, this.device.env_decay, this.device.env_sustain, this.device.env_release)
        this.env.gateOn()
        this.glide = new Glide()
        this.gainSmooth = new Smooth(0.003, sampleRate)
    }

    start(id: int, frequency: number, velocity: unitValue, gain: number, panning: number): void {
        this.id = id
        this.velocity = velocity
        this.gain = gain
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
        const {
            gain: deviceGain,
            osc_waveform,
            flt_cutoff,
            flt_resonance,
            flt_env_amount,
            flt_order,
            frequencyMultiplier
        } = this.device
        const gain = velocityToGain(this.velocity) * this.gain * deviceGain
        const [gainL, gainR] = StereoMatrix.panningToGains(this.panning, StereoMatrix.Mixing.Linear)
        const [outL, outR] = output.channels()

        freqBuffer.fill(frequencyMultiplier, fromIndex, toIndex)
        this.glide.process(freqBuffer, bpm, fromIndex, toIndex)
        this.osc.generateFromFrequencies(oscBuffer, freqBuffer, osc_waveform, fromIndex, toIndex)
        this.env.process(envBuffer, fromIndex, toIndex)

        for (let i = fromIndex; i < toIndex; i++) {
            cutoffBuffer[i] = flt_cutoff + envBuffer[i] * flt_env_amount
            this.lfoPhase += 0.001
        }

        this.filter.order = flt_order
        this.filter.process(oscBuffer, oscBuffer, cutoffBuffer, flt_resonance, fromIndex, toIndex)

        for (let i = fromIndex; i < toIndex; i++) {
            const vca = this.gainSmooth.process(envBuffer[i] * gain)
            const osc = oscBuffer[i] * vca
            outL[i] += osc * gainL
            outR[i] += osc * gainR
            if (this.env.complete && vca < SILENCE_THRESHOLD) {return true}
        }
        return false
    }
}