export enum Waveform { sine, triangle, sawtooth, square }

export class BandLimitedOscillator {
    #phase = 0.0
    #integrator = 0.0
    readonly #invSampleRate: number

    constructor(sampleRate: number) {
        this.#invSampleRate = 1 / sampleRate
    }

    generate(buffer: Float32Array, frequency: number, waveform: Waveform, fromIndex: number, toIndex: number): void {
        const phaseInc = frequency * this.#invSampleRate
        for (let i = fromIndex; i < toIndex; i++) {
            const t = this.#phase % 1.0
            let out = 0.0
            switch (waveform) {
                case Waveform.sine:
                    out = Math.sin(2.0 * Math.PI * t)
                    break
                case Waveform.sawtooth:
                    out = 2.0 * t - 1.0
                    out -= this.#polyBLEP(t, phaseInc)
                    break
                case Waveform.square:
                    out = t < 0.5 ? 1.0 : -1.0
                    out += this.#polyBLEP(t, phaseInc)
                    out -= this.#polyBLEP((t + 0.5) % 1.0, phaseInc)
                    break
                case Waveform.triangle:
                    let sq = t < 0.5 ? 1.0 : -1.0
                    sq += this.#polyBLEP(t, phaseInc)
                    sq -= this.#polyBLEP((t + 0.5) % 1.0, phaseInc)
                    this.#integrator += sq * (4.0 * phaseInc)
                    out = this.#integrator
                    break
            }
            buffer[i] = out
            this.#phase += phaseInc
        }
    }

    generateFromFrequencies(output: Float32Array,
                            freqBuffer: Float32Array,
                            waveform: Waveform,
                            fromIndex: number,
                            toIndex: number): void {
        for (let i = fromIndex; i < toIndex; i++) {
            const phaseInc = freqBuffer[i] * this.#invSampleRate
            const t = this.#phase % 1.0
            let out = 0.0
            switch (waveform) {
                case Waveform.sine:
                    out = Math.sin(2.0 * Math.PI * t)
                    break
                case Waveform.sawtooth:
                    out = 2.0 * t - 1.0
                    out -= this.#polyBLEP(t, phaseInc)
                    break
                case Waveform.square:
                    out = t < 0.5 ? 1.0 : -1.0
                    out += this.#polyBLEP(t, phaseInc)
                    out -= this.#polyBLEP((t + 0.5) % 1.0, phaseInc)
                    break
                case Waveform.triangle:
                    let sq = t < 0.5 ? 1.0 : -1.0
                    sq += this.#polyBLEP(t, phaseInc)
                    sq -= this.#polyBLEP((t + 0.5) % 1.0, phaseInc)
                    this.#integrator += sq * (4.0 * phaseInc)
                    out = this.#integrator
                    break
            }
            output[i] = out
            this.#phase += phaseInc
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
