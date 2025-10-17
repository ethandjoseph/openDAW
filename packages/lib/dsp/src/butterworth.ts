import {int} from "@opendaw/lib-std"

export class ButterworthCoeff {
    b0: number = 1.0
    b1: number = 0.0
    b2: number = 0.0
    a1: number = 0.0
    a2: number = 0.0

    setLowpassFrequency(frequency: number, sampleRate: number): void {
        const cutoffNormalized = Math.max(20.0, Math.min(frequency, sampleRate / 2.0)) / sampleRate
        const clampedCutoff = Math.max(0.0001, Math.min(0.49, cutoffNormalized))
        const omega = 2.0 * Math.PI * clampedCutoff
        const sin_omega = Math.sin(omega)
        const cos_omega = Math.cos(omega)
        const alpha = sin_omega / (2.0 * Math.SQRT2)
        const a0 = 1.0 + alpha
        this.b0 = ((1.0 - cos_omega) / 2.0) / a0
        this.b1 = (1.0 - cos_omega) / a0
        this.b2 = ((1.0 - cos_omega) / 2.0) / a0
        this.a1 = (-2.0 * cos_omega) / a0
        this.a2 = (1.0 - alpha) / a0
    }
}

export class ButterworthProcessor {
    #x1: number = 0.0
    #x2: number = 0.0

    processSample({a1, a2, b0, b1, b2}: ButterworthCoeff, input: number): number {
        const output = b0 * input + this.#x1
        this.#x1 = b1 * input - a1 * output + this.#x2
        this.#x2 = b2 * input - a2 * output
        return output
    }

    process({a1, a2, b0, b1, b2}: ButterworthCoeff,
            input: Float32Array, output: Float32Array, from: int, to: int): void {
        for (let i = from; i < to; i++) {
            const inp = input[i]
            const out = b0 * inp + this.#x1
            this.#x1 = b1 * inp - a1 * out + this.#x2
            this.#x2 = b2 * inp - a2 * out
            output[i] = out
        }
    }

    reset(): void {
        this.#x1 = 0.0
        this.#x2 = 0.0
    }
}

