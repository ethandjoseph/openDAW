import {int} from "@opendaw/lib-std"

export class LookAhead {
    readonly #buffer: Float32Array
    readonly #delayInSamples: int
    readonly #bufferSize: int

    #writePosition: int = 0
    #numLastPushed: int = 0

    constructor(sampleRate: number, delay: number, blockSize: int) {
        this.#delayInSamples = Math.floor(sampleRate * delay)
        this.#bufferSize = blockSize + this.#delayInSamples
        this.#buffer = new Float32Array(this.#bufferSize)
        this.#writePosition = 0
    }

    process(src: Float32Array, numSamples: int): void {
        this.#pushSamples(src, numSamples)
        this.#processSamples()
        this.#readSamples(src, numSamples)
    }

    #pushSamples(src: Float32Array, numSamples: int): void {
        for (let i = 0; i < numSamples; i++) {
            this.#buffer[this.#writePosition] = src[i]
            this.#writePosition = (this.#writePosition + 1) % this.#bufferSize
        }
        this.#numLastPushed = numSamples
    }

    #readSamples(dst: Float32Array, numSamples: int): void {
        let readPosition = (this.#writePosition - this.#numLastPushed - this.#delayInSamples + this.#bufferSize) % this.#bufferSize
        for (let i = 0; i < numSamples; i++) {
            dst[i] = this.#buffer[readPosition]
            readPosition = (readPosition + 1) % this.#bufferSize
        }
    }

    #processSamples(): void {
        let index = (this.#writePosition - 1 + this.#bufferSize) % this.#bufferSize
        let nextValue = 0.0
        let slope = 0.0

        // Process the samples that were just pushed
        for (let i = 0; i < this.#numLastPushed; i++) {
            const sample = this.#buffer[index]
            if (sample > nextValue) {
                this.#buffer[index] = nextValue
                nextValue += slope
            } else {
                slope = -sample / this.#delayInSamples
                nextValue = sample + slope
            }
            index = (index - 1 + this.#bufferSize) % this.#bufferSize
        }

        // Process the delay range
        let procMinimumFound = false
        for (let i = 0; i < this.#delayInSamples && !procMinimumFound; i++) {
            const sample = this.#buffer[index]
            if (sample > nextValue) {
                this.#buffer[index] = nextValue
                nextValue += slope
            } else {
                procMinimumFound = true
                break
            }
            index = (index - 1 + this.#bufferSize) % this.#bufferSize
        }
    }
}