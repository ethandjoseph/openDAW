import {int} from "@opendaw/lib-std"
import {AudioBuffer} from "../../../AudioBuffer"

// Delay Line for lookahead
export class DelayLine {
    readonly #delayBuffer: Float32Array[] = []
    readonly #delayBufferSize: int
    readonly #delayInSamples: int
    readonly #numChannels: int

    #writePosition: int = 0

    constructor(sampleRate: number, delayInSeconds: number, maxBlockSize: int, numChannels: int) {
        this.#numChannels = numChannels
        this.#delayInSamples = Math.floor(sampleRate * delayInSeconds)
        this.#delayBufferSize = maxBlockSize + this.#delayInSamples

        for (let ch = 0; ch < numChannels; ch++) {
            this.#delayBuffer[ch] = new Float32Array(this.#delayBufferSize)
        }
        this.#writePosition = 0
    }

    process(buffer: AudioBuffer, numSamples: int): void {
        if (this.#delayInSamples === 0) return

        for (let ch = 0; ch < this.#numChannels; ch++) {
            const channelData = buffer.getChannel(ch)

            // Push samples
            for (let i = 0; i < numSamples; i++) {
                this.#delayBuffer[ch][this.#writePosition] = channelData[i]
                this.#writePosition = (this.#writePosition + 1) % this.#delayBufferSize
            }

            // Read samples
            let readPosition = (this.#writePosition - numSamples - this.#delayInSamples + this.#delayBufferSize) % this.#delayBufferSize
            for (let i = 0; i < numSamples; i++) {
                channelData[i] = this.#delayBuffer[ch][readPosition]
                readPosition = (readPosition + 1) % this.#delayBufferSize
            }
        }
    }
}