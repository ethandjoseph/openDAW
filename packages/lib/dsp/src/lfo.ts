export enum LFOShape {sine, triangle, saw, square}

export class LFO {
    #phase = 0.0

    constructor(readonly sampleRate: number) {}

    fill(buffer: Float32Array, shape: LFOShape, frequency: number, fromIndex: number, toIndex: number): void {
        const phaseInc = frequency / this.sampleRate
        switch (shape) {
            case LFOShape.sine: {
                for (let i = fromIndex; i < toIndex; i++) {
                    buffer[i] = Math.sin(this.#phase * Math.PI * 2.0)
                    this.#phase += phaseInc
                    if (this.#phase >= 1.0) { this.#phase -= 1.0 }
                }
                break
            }
            case LFOShape.triangle: {
                for (let i = fromIndex; i < toIndex; i++) {
                    const phase = this.#phase % 1.0
                    buffer[i] = 4.0 * Math.abs(phase - 0.5) - 1.0
                    this.#phase += phaseInc
                    if (this.#phase >= 1.0) { this.#phase -= 1.0 }
                }
                break
            }
            case LFOShape.saw: {
                for (let i = fromIndex; i < toIndex; i++) {
                    const phase = this.#phase % 1.0
                    buffer[i] = 2.0 * phase - 1.0
                    this.#phase += phaseInc
                    if (this.#phase >= 1.0) { this.#phase -= 1.0 }
                }
                break
            }
            case LFOShape.square: {
                for (let i = fromIndex; i < toIndex; i++) {
                    const phase = this.#phase % 1.0
                    buffer[i] = phase < 0.5 ? 1.0 : -1.0
                    this.#phase += phaseInc
                    if (this.#phase >= 1.0) { this.#phase -= 1.0 }
                }
                break
            }
        }
    }

    reset(): void {
        this.#phase = 0.0
    }
}