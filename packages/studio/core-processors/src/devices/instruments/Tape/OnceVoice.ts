import {AudioBuffer, AudioData} from "@opendaw/lib-dsp"
import {Segment} from "./Segment"
import {VoiceState} from "./VoiceState"
import {int} from "@opendaw/lib-std"
import {Voice} from "./Voice"

export class OnceVoice implements Voice {
    readonly #output: AudioBuffer
    readonly #data: AudioData
    readonly #segment: Segment
    readonly #fadeLength: number

    #state: VoiceState = VoiceState.FadingIn
    #readPosition: number
    #fadeProgress: number = 0.0

    constructor(output: AudioBuffer, data: AudioData, segment: Segment, fadeLength: number, offset: number = 0.0) {
        this.#output = output
        this.#data = data
        this.#segment = segment
        this.#fadeLength = fadeLength
        this.#readPosition = segment.start + offset
        if (this.#readPosition >= segment.end) {
            this.#state = VoiceState.Done
        }
    }

    done(): boolean {return this.#state === VoiceState.Done}

    startFadeOut(): void {
        if (this.#state === VoiceState.Done || this.#state === VoiceState.FadingOut) {return}
        if (this.#state === VoiceState.FadingIn) {
            // Continue fade out from current amplitude level
            const currentAmplitude = this.#fadeProgress / this.#fadeLength
            this.#fadeProgress = this.#fadeLength * (1.0 - currentAmplitude)
        } else {
            this.#fadeProgress = 0.0
        }
        this.#state = VoiceState.FadingOut
    }

    process(bufferStart: int, bufferCount: int): void {
        const [outL, outR] = this.#output.channels()
        const {frames, numberOfFrames} = this.#data
        const framesL = frames[0]
        const framesR = frames.length === 1 ? frames[0] : frames[1]
        const fadeLength = this.#fadeLength
        const segmentEnd = this.#segment.end
        const fadeOutThreshold = segmentEnd - fadeLength
        let state: VoiceState = this.#state
        let readPosition = this.#readPosition
        let fadeProgress = this.#fadeProgress
        for (let i = 0; i < bufferCount; i++) {
            if (state === VoiceState.Done) {break}
            const j = bufferStart + i
            let amplitude: number
            if (state === VoiceState.FadingIn) {
                amplitude = fadeProgress / fadeLength
                if (++fadeProgress >= fadeLength) {
                    state = VoiceState.Active
                    fadeProgress = 0.0
                }
            } else if (state === VoiceState.FadingOut) {
                amplitude = 1.0 - fadeProgress / fadeLength
                if (++fadeProgress >= fadeLength) {
                    state = VoiceState.Done
                    break
                }
            } else {
                amplitude = 1.0
            }
            const readInt = readPosition | 0
            if (readInt >= 0 && readInt < numberOfFrames - 1) {
                const alpha = readPosition - readInt
                const sL = framesL[readInt]
                const sR = framesR[readInt]
                outL[j] += (sL + alpha * (framesL[readInt + 1] - sL)) * amplitude
                outR[j] += (sR + alpha * (framesR[readInt + 1] - sR)) * amplitude
            }
            readPosition += 1.0
            if (state === VoiceState.Active && readPosition >= fadeOutThreshold) {
                state = VoiceState.FadingOut
                fadeProgress = 0.0
            }
        }
        this.#state = state
        this.#readPosition = readPosition
        this.#fadeProgress = fadeProgress
    }
}