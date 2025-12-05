import {int} from "@opendaw/lib-std"
import {AudioBuffer, AudioData} from "@opendaw/lib-dsp"
import {Segment} from "./Segment"
import {VoiceState} from "./VoiceState"
import {Voice} from "./Voice"
import {FADE_LENGTH, FADE_LENGTH_INVERSE, LOOP_END_MARGIN, LOOP_START_MARGIN} from "./constants"

export class RepeatVoice implements Voice {
    readonly #output: AudioBuffer
    readonly #data: AudioData
    readonly #playbackRate: number
    readonly #loopStart: number
    readonly #loopEnd: number

    #state: VoiceState = VoiceState.FadingIn
    #readPosition: number
    #fadeProgress: number = 0.0
    #loopFadeProgress: number = 0.0
    #loopFadePosition: number = 0.0
    #blockOffset: int
    #fadeOutBlockOffset: int = 0

    constructor(output: AudioBuffer, data: AudioData, segment: Segment, playbackRate: number, blockOffset: int = 0) {
        this.#output = output
        this.#data = data
        this.#playbackRate = playbackRate
        this.#loopStart = segment.start + LOOP_START_MARGIN
        this.#loopEnd = segment.end - LOOP_END_MARGIN
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
            // Continue fade out from current amplitude level
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
        const loopStart = this.#loopStart
        const loopEnd = this.#loopEnd
        const loopCrossfadeStart = loopEnd - FADE_LENGTH
        const fadeOutBlockOffset = this.#fadeOutBlockOffset
        let state = this.#state
        let readPosition = this.#readPosition
        let fadeProgress = this.#fadeProgress
        let loopFadeProgress = this.#loopFadeProgress
        let loopFadePosition = this.#loopFadePosition
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
            let sampleL = 0.0
            let sampleR = 0.0
            if (readInt >= 0 && readInt < numberOfFrames - 1) {
                const alpha = readPosition - readInt
                const sL = framesL[readInt]
                const sR = framesR[readInt]
                sampleL = sL + alpha * (framesL[readInt + 1] - sL)
                sampleR = sR + alpha * (framesR[readInt + 1] - sR)
            }
            if (readPosition >= loopCrossfadeStart) {
                if (loopFadeProgress === 0.0) {
                    loopFadePosition = loopStart
                }
                const loopReadInt = loopFadePosition | 0
                if (loopReadInt >= 0 && loopReadInt < numberOfFrames - 1) {
                    const alpha = loopFadePosition - loopReadInt
                    const sL = framesL[loopReadInt]
                    const sR = framesR[loopReadInt]
                    const loopSampleL = sL + alpha * (framesL[loopReadInt + 1] - sL)
                    const loopSampleR = sR + alpha * (framesR[loopReadInt + 1] - sR)
                    const crossfade = loopFadeProgress * FADE_LENGTH_INVERSE
                    sampleL = sampleL * (1.0 - crossfade) + loopSampleL * crossfade
                    sampleR = sampleR * (1.0 - crossfade) + loopSampleR * crossfade
                }
                loopFadeProgress += 1.0
                loopFadePosition += 1.0
                if (loopFadeProgress >= FADE_LENGTH) {
                    readPosition = loopFadePosition
                    loopFadeProgress = 0.0
                }
            }
            outL[j] += sampleL * amplitude
            outR[j] += sampleR * amplitude
            readPosition += this.#playbackRate
        }
        this.#state = state
        this.#readPosition = readPosition
        this.#fadeProgress = fadeProgress
        this.#loopFadeProgress = loopFadeProgress
        this.#loopFadePosition = loopFadePosition
        this.#blockOffset = 0
        this.#fadeOutBlockOffset = 0
    }
}