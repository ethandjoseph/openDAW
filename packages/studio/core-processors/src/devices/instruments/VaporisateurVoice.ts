import {Voice} from "../../voicing/Voice"
import {
    AudioBuffer,
    BandLimitedOscillator,
    BiquadCoeff,
    BiquadMono,
    dbToGain,
    PPQN,
    ppqn,
    RenderQuantum,
    Smooth,
    StereoMatrix,
    velocityToGain
} from "@opendaw/lib-dsp"
import {ADSR} from "../../envelopes/ADSR"
import {clamp, int, unitValue} from "@opendaw/lib-std"
import {Block} from "../../processing"
import {VaporisateurDeviceProcessor} from "./VaporisateurDeviceProcessor"
import Mixing = StereoMatrix.Mixing

export class VaporisateurVoice implements Voice {
    readonly device: VaporisateurDeviceProcessor
    readonly osc: BandLimitedOscillator
    readonly buffer: Float32Array
    readonly filterCoeff: BiquadCoeff
    readonly filterProcessor: BiquadMono
    readonly adsr: ADSR
    readonly adsrBuffer: Float32Array
    readonly freqBuffer: Float32Array
    readonly gainSmooth: Smooth

    id: int = -1
    beginFrequency: number = 0.0
    currentFrequency: number = NaN
    velocity: unitValue = 0.0
    targetFrequency: number = NaN
    glidePosition: number = 0.0
    glideDuration: number = 0.0
    panning: number = 0.0

    phase: number = 0.0

    constructor(device: VaporisateurDeviceProcessor) {
        this.device = device

        this.osc = new BandLimitedOscillator(sampleRate)
        this.buffer = new Float32Array(RenderQuantum)
        this.filterCoeff = new BiquadCoeff()
        this.filterProcessor = new BiquadMono()
        this.adsr = new ADSR(sampleRate)
        this.adsr.set(this.device.attack, this.device.decay, this.device.sustain, this.device.release)
        this.adsr.gateOn()
        this.adsrBuffer = new Float32Array(RenderQuantum)
        this.freqBuffer = new Float32Array(RenderQuantum)
        this.gainSmooth = new Smooth(0.003, sampleRate)
    }

    start(id: int, frequency: number, velocity: unitValue, panning: number = 0.0): void {
        this.id = id
        this.beginFrequency = frequency
        this.velocity = velocity
        this.panning = panning

        if (isNaN(this.currentFrequency)) {
            this.currentFrequency = this.beginFrequency
        }
    }

    stop(): void {this.adsr.gateOff()}

    forceStop(): void {this.adsr.forceStop()}

    startGlide(targetFrequency: number, glideDuration: ppqn): void {
        if (glideDuration === 0.0) {
            this.beginFrequency = targetFrequency
            return
        }
        this.beginFrequency = this.currentFrequency
        this.targetFrequency = targetFrequency
        this.glidePosition = 0.0
        this.glideDuration = glideDuration
    }

    get gate(): boolean {return this.adsr.gate}

    process(output: AudioBuffer, {bpm}: Block, fromIndex: int, toIndex: int): boolean {
        const gain = velocityToGain(this.velocity) * this.device.gain * dbToGain(-15)
        const waveform = this.device.waveform
        const cutoffMapping = this.device.adapter.namedParameter.cutoff.valueMapping
        const cutoff = cutoffMapping.x(this.device.cutoff)
        const resonance = this.device.resonance
        const filterEnvelope = this.device.filterEnvelope
        const outL = output.getChannel(0)
        const outR = output.getChannel(1)

        if (isNaN(this.targetFrequency)) {
            this.freqBuffer.fill(this.beginFrequency, fromIndex, toIndex)
            this.currentFrequency = this.beginFrequency
        } else {
            const ppqnPerSample = PPQN.samplesToPulses(1, bpm, sampleRate)
            for (let i = fromIndex; i < toIndex; i++) {
                this.glidePosition += ppqnPerSample / this.glideDuration
                if (this.glidePosition >= 1.0) {
                    this.glidePosition = 1.0
                    this.beginFrequency = this.targetFrequency
                    this.targetFrequency = NaN
                    this.freqBuffer.fill(this.beginFrequency, i, toIndex)
                    break
                }
                this.currentFrequency = this.beginFrequency + (this.targetFrequency - this.beginFrequency) * this.glidePosition
                this.freqBuffer[i] = this.currentFrequency
            }
        }

        this.osc.generateFromFrequencies(this.buffer, this.freqBuffer, waveform, fromIndex, toIndex)
        this.adsr.process(this.adsrBuffer, fromIndex, toIndex)
        const [gainL, gainR] = StereoMatrix.panningToGains(this.panning, Mixing.EqualPower)
        for (let i = fromIndex; i < toIndex; i++) {
            const env = this.gainSmooth.process(this.adsrBuffer[i])
            this.filterCoeff.setLowpassParams(cutoffMapping.y(clamp(cutoff + env * filterEnvelope, 0.0, 1.0)) / sampleRate, resonance)
            const amp = this.filterProcessor.processFrame(this.filterCoeff, this.buffer[i]) * gain * env
            outL[i] += amp * gainL
            outR[i] += amp * gainR
            if (this.adsr.complete && this.gainSmooth.value < 1e-6) {return true}
        }
        return false
    }
}