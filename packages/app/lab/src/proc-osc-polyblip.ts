import {RenderQuantum} from "@opendaw/lib-dsp"
import {Communicator, Messenger} from "@opendaw/lib-runtime"
import {Protocol} from "./protocol"
import {TAU} from "@opendaw/lib-std"
import {Waveform} from "./waveform"

export class Oscillator {
    waveform: Waveform = Waveform.SINE
    phase = 0.0
    phaseInc = 0.0
    lastOut = 0.0
    pw = 0.5
    amp = 1.0
    eoc = false
    eor = false
    srRecip: number

    constructor(sampleRate: number) {
        this.srRecip = 1.0 / sampleRate
    }

    setFrequency(f: number): void {
        this.phaseInc = f * this.srRecip
    }

    process(): number {
        let out: number
        let t: number = 0.0

        switch (this.waveform) {
            case Waveform.SINE:
                out = Math.sin(this.phase * TAU)
                break

            case Waveform.TRIANGLE:
                t = -1.0 + 2.0 * this.phase
                out = 2.0 * (Math.abs(t) - 0.5)
                break

            case Waveform.SAWTOOTH:
                out = -((this.phase * 2.0) - 1.0)
                break

            case Waveform.RAMP:
                out = (this.phase * 2.0) - 1.0
                break

            case Waveform.SQUARE:
                out = this.phase < this.pw ? 1.0 : -1.0
                break

            case Waveform.POLYBLEP_TRI: {
                t = this.phase
                out = this.phase < 0.5 ? 1.0 : -1.0
                out += polyblep(this.phaseInc, t)
                out -= polyblep(this.phaseInc, fastmod1f(t + 0.5))
                // Leaky Integrator:
                out = this.phaseInc * out + (1.0 - this.phaseInc) * this.lastOut
                this.lastOut = out
                out *= 4.0 // normalize
                break
            }

            case Waveform.POLYBLEP_SAW: {
                t = this.phase
                out = (2.0 * t) - 1.0
                out -= polyblep(this.phaseInc, t)
                out *= -1.0
                break
            }

            case Waveform.POLYBLEP_SQUARE: {
                t = this.phase
                out = this.phase < this.pw ? 1.0 : -1.0
                out += polyblep(this.phaseInc, t)
                out -= polyblep(this.phaseInc, fastmod1f(t + (1.0 - this.pw)))
                out *= 0.707 // scaling factor
                break
            }

            default:
                out = 0.0
                break
        }

        this.phase += this.phaseInc
        if (this.phase > 1.0) {
            this.phase -= 1.0
            this.eoc = true
        } else {
            this.eoc = false
        }
        this.eor = this.phase - this.phaseInc < 0.5 && this.phase >= 0.5
        return out * this.amp
    }
}

function fastmod1f(x: number): number {
    return x - Math.floor(x)
}

function polyblep(phaseInc: number, t: number): number {
    const dt = phaseInc
    if (t < dt) {
        t /= dt
        return t + t - t * t - 1.0
    } else if (t > 1.0 - dt) {
        t = (t - 1.0) / dt
        return t * t + t + t + 1.0
    } else {
        return 0.0
    }
}

registerProcessor("proc-osc-polyblip", class ProcOscPolyblip extends AudioWorkletProcessor {
    readonly #oscillator: Oscillator

    constructor() {
        super()

        this.#oscillator = new Oscillator(sampleRate)
        this.#oscillator.waveform = Waveform.POLYBLEP_SAW

        Communicator.executor<Protocol>(Messenger.for(this.port), {
            setWaveform: (value: Waveform) => this.#oscillator.waveform = value,
            setFrequency: (value: number) => this.#oscillator.setFrequency(value)
        })
    }

    process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
        const [[mono]] = outputs
        for (let i = 0; i < RenderQuantum; i++) {
            mono[i] = this.#oscillator.process()
        }
        return true
    }
})