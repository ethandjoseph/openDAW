import {RenderQuantum} from "./constants"
import {clamp, clampUnit, int} from "@opendaw/lib-std"
import {ButterworthCoeff, ButterworthProcessor} from "./butterworth"
import {StereoMatrix} from "./stereo"
import {dbToGain} from "./utils"

export class Crusher {
    readonly #sampleRate: number

    readonly #filterCoeff: ButterworthCoeff
    readonly #filters: [ButterworthProcessor, ButterworthProcessor]
    readonly #filteredBuffer: StereoMatrix.Channels
    readonly #heldSample: Float32Array

    #crushedSampleRate: number = NaN
    #phase: number = 0.0
    #bitDepth: number = 8
    #boostDb: number = 0.0
    #mix: number = 1.0

    constructor(sampleRate: number) {
        this.#sampleRate = sampleRate
        this.#filterCoeff = new ButterworthCoeff()
        this.#filterCoeff.setLowpassFrequency(sampleRate / 2.0, sampleRate)
        this.#filters = [new ButterworthProcessor(), new ButterworthProcessor()]
        this.#filteredBuffer = [new Float32Array(RenderQuantum), new Float32Array(RenderQuantum)]
        this.#heldSample = new Float32Array(2)
        this.setCrushedSampleRate(sampleRate)
    }

    process(input: StereoMatrix.Channels, output: StereoMatrix.Channels, from: int, to: int): void {
        const [inpL, inpR] = input
        const [outL, outR] = output
        const [fltL, fltR] = this.#filteredBuffer
        this.#filters[0].process(this.#filterCoeff, inpL, fltL, from, to)
        this.#filters[1].process(this.#filterCoeff, inpR, fltR, from, to)
        const preGain = dbToGain(this.#boostDb)
        const postGain = dbToGain(-this.#boostDb)
        const crushRatio = this.#sampleRate / this.#crushedSampleRate
        const steps = Math.pow(2.0, this.#bitDepth) - 1.0
        const stepInv = 1.0 / steps
        for (let i = from; i < to; i++) {
            this.#phase += 1.0
            if (this.#phase >= crushRatio) {
                this.#phase -= crushRatio
                this.#heldSample[0] = clamp(Math.round(fltL[i] * preGain * steps) * stepInv, -1.0, 1.0)
                this.#heldSample[1] = clamp(Math.round(fltR[i] * preGain * steps) * stepInv, -1.0, 1.0)
            }
            outL[i] = (inpL[i] * (1.0 - this.#mix) + this.#heldSample[0] * this.#mix) * postGain
            outR[i] = (inpR[i] * (1.0 - this.#mix) + this.#heldSample[1] * this.#mix) * postGain
        }
    }

    setCrushedSampleRate(rate: number): void {
        this.#crushedSampleRate = clamp(rate, 100.0, this.#sampleRate)
        this.#filterCoeff.setLowpassFrequency(this.#crushedSampleRate / 2.0, this.#sampleRate)
    }

    setBitDepth(bits: int): void {this.#bitDepth = clamp(bits, 1, 16)}

    setBoost(db: number): void {this.#boostDb = db}

    setMix(mix: number): void {this.#mix = clampUnit(mix)}

    reset(): void {
        this.#phase = 0.0
        this.#heldSample.fill(0.0)
        this.#filters[0].reset()
        this.#filters[1].reset()
    }
}