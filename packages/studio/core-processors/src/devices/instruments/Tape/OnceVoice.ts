import {AudioBuffer, AudioData} from "@opendaw/lib-dsp"
import {Segment} from "./Segment"
import {VoiceState} from "./VoiceState"
import {int} from "@opendaw/lib-std"
import {Voice} from "./Voice"
import {FADE_LENGTH, FADE_LENGTH_INVERSE} from "./constants"

export class OnceVoice implements Voice {
    readonly #output: AudioBuffer
    readonly #data: AudioData
    readonly #playbackRate: number
    readonly #segment: Segment

    #state: VoiceState = VoiceState.FadingIn
    #readPosition: number
    #fadeProgress: number = 0.0
    #blockOffset: int
    #fadeOutBlockOffset: int = 0

    constructor(output: AudioBuffer, data: AudioData, segment: Segment, playbackRate: number, blockOffset: int = 0) {
        this.#output = output
        this.#data = data
        this.#playbackRate = playbackRate
        this.#segment = segment
        this.#readPosition = segment.start
        this.#blockOffset = blockOffset
        if (this.#readPosition >= segment.end) {
            this.#state = VoiceState.Done
        }
    }

    done(): boolean {return this.#state === VoiceState.Done}

    startFadeOut(blockOffset: int): void {
        if (this.#state === VoiceState.Done || this.#state === VoiceState.FadingOut) {return}
        if (this.#state === VoiceState.FadingIn) {
            const currentAmplitude = this.#fadeProgress * FADE_LENGTH_INVERSE
            this.#fadeProgress = FADE_LENGTH * (1.0 - currentAmplitude)
        } else {
            this.#fadeProgress = 0.0
        }
        this.#state = VoiceState.FadingOut
        this.#fadeOutBlockOffset = blockOffset
    }

    process(bufferStart: int, bufferCount: int): void {
        const [outL, outR] = this.#output.channels()
        const {frames, numberOfFrames} = this.#data
        const framesL = frames[0]
        const framesR = frames.length === 1 ? frames[0] : frames[1]
        const segmentEnd = this.#segment.end
        const fadeOutThreshold = segmentEnd - FADE_LENGTH
        const fadeOutBlockOffset = this.#fadeOutBlockOffset
        let state: VoiceState = this.#state
        let readPosition = this.#readPosition
        let fadeProgress = this.#fadeProgress
        for (let i = this.#blockOffset; i < bufferCount; i++) {
            if (state === VoiceState.Done) {break}
            // Skip samples until we reach the block offset where this voice should start
            const j = bufferStart + i
            let amplitude: number
            if (state === VoiceState.FadingIn) {
                amplitude = fadeProgress * FADE_LENGTH_INVERSE
                if (++fadeProgress >= FADE_LENGTH) {
                    state = VoiceState.Active
                    fadeProgress = 0.0
                }
            } else if (state === VoiceState.FadingOut) {
                // Don't start fading until we reach the fadeout block offset
                if (i < fadeOutBlockOffset) {
                    amplitude = 1.0
                } else {
                    amplitude = 1.0 - fadeProgress * FADE_LENGTH_INVERSE
                    if (++fadeProgress >= FADE_LENGTH) {
                        state = VoiceState.Done
                        break
                    }
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
            readPosition += this.#playbackRate
            if (state === VoiceState.Active && readPosition >= fadeOutThreshold) {
                state = VoiceState.FadingOut
                fadeProgress = 0.0
            }
        }
        this.#state = state
        this.#readPosition = readPosition
        this.#fadeProgress = fadeProgress
        this.#blockOffset = 0
        this.#fadeOutBlockOffset = 0
    }
}