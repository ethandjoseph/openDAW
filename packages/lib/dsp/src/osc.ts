import {ClassicWaveform} from "./classic-waveform"

export class BandLimitedOscillator {
    readonly #invSampleRate: number

    #phase = 0.0
    #integrator = 0.0

    constructor(sampleRate: number) {
        this.#invSampleRate = 1.0 / sampleRate
    }

    generate(output: Float32Array, frequency: number, waveform: ClassicWaveform, fromIndex: number, toIndex: number): void {
        const phaseInc = frequency * this.#invSampleRate

        switch (waveform) {
            case ClassicWaveform.sine:
                for (let i = fromIndex; i < toIndex; i++) {
                    const t = this.#phase % 1.0
                    output[i] = Math.sin(2.0 * Math.PI * t)
                    this.#phase += phaseInc
                }
                break

            case ClassicWaveform.saw:
                for (let i = fromIndex; i < toIndex; i++) {
                    const t = this.#phase % 1.0
                    let out = 2.0 * t - 1.0
                    out -= this.#polyBLEP(t, phaseInc)
                    output[i] = out
                    this.#phase += phaseInc
                }
                break

            case ClassicWaveform.square:
                for (let i = fromIndex; i < toIndex; i++) {
                    const t = this.#phase % 1.0
                    let out = t < 0.5 ? 1.0 : -1.0
                    out += this.#polyBLEP(t, phaseInc)
                    out -= this.#polyBLEP((t + 0.5) % 1.0, phaseInc)
                    output[i] = out
                    this.#phase += phaseInc
                }
                break

            case ClassicWaveform.triangle:
                for (let i = fromIndex; i < toIndex; i++) {
                    const t = this.#phase % 1.0
                    let sq = t < 0.5 ? 1.0 : -1.0
                    sq += this.#polyBLEP(t, phaseInc)
                    sq -= this.#polyBLEP((t + 0.5) % 1.0, phaseInc)
                    this.#integrator += sq * (4.0 * phaseInc)
                    output[i] = this.#integrator
                    this.#phase += phaseInc
                }
                break
        }
    }

    generateFromFrequencies(output: Float32Array,
                            freqBuffer: Float32Array,
                            waveform: ClassicWaveform,
                            fromIndex: number,
                            toIndex: number): void {
        switch (waveform) {
            case ClassicWaveform.sine:
                for (let i = fromIndex; i < toIndex; i++) {
                    const phaseInc = freqBuffer[i] * this.#invSampleRate
                    const t = this.#phase % 1.0
                    output[i] = Math.sin(2.0 * Math.PI * t)
                    this.#phase += phaseInc
                }
                break

            case ClassicWaveform.saw:
                for (let i = fromIndex; i < toIndex; i++) {
                    const phaseInc = freqBuffer[i] * this.#invSampleRate
                    const t = this.#phase % 1.0
                    let out = 2.0 * t - 1.0
                    out -= this.#polyBLEP(t, phaseInc)
                    output[i] = out
                    this.#phase += phaseInc
                }
                break

            case ClassicWaveform.square:
                for (let i = fromIndex; i < toIndex; i++) {
                    const phaseInc = freqBuffer[i] * this.#invSampleRate
                    const t = this.#phase % 1.0
                    let out = t < 0.5 ? 1.0 : -1.0
                    out += this.#polyBLEP(t, phaseInc)
                    out -= this.#polyBLEP((t + 0.5) % 1.0, phaseInc)
                    output[i] = out
                    this.#phase += phaseInc
                }
                break

            case ClassicWaveform.triangle:
                for (let i = fromIndex; i < toIndex; i++) {
                    const t = this.#phase % 1.0
                    const inc = freqBuffer[i] * this.#invSampleRate
                    let sq = t < 0.5 ? 1.0 : -1.0
                    sq += this.#polyBLEP(t, inc)
                    sq -= this.#polyBLEP((t + 0.5) % 1.0, inc)
                    this.#integrator += sq * (4.0 * inc)
                    this.#integrator *= 0.9995 // leak DC
                    output[i] = this.#integrator
                    this.#phase += inc
                }
                break
        }
    }

    #polyBLEP(t: number, dt: number): number {
        if (t < dt) {
            t /= dt
            return t + t - t * t - 1.0
        } else if (t > 1.0 - dt) {
            t = (t - 1.0) / dt
            return t * t + t + t + 1.0
        }
        return 0.0
    }
}