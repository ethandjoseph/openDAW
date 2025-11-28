import {int} from "@opendaw/lib-std"
import {AudioBuffer, AudioData} from "@opendaw/lib-dsp"
import {VoiceState} from "./VoiceState"

export class PitchVoice {
    readonly #output: AudioBuffer
    readonly #data: AudioData
    readonly #fadeLength: number

    #state: VoiceState = VoiceState.FadingIn
    #readPosition: number
    #fadeProgress: number = 0.0
    #playbackRate: number

    constructor(output: AudioBuffer, data: AudioData, fadeLength: number, playbackRate: number, offset: number = 0.0) {
        this.#output = output
        this.#data = data
        this.#fadeLength = fadeLength
        this.#playbackRate = playbackRate
        this.#readPosition = offset
        if (this.#readPosition >= data.numberOfFrames) {
            this.#state = VoiceState.Done
        }
    }

    get done(): boolean {return this.#state === VoiceState.Done}

    startFadeOut(): void {
        if (this.#state !== VoiceState.Done && this.#state !== VoiceState.FadingOut) {
            this.#state = VoiceState.FadingOut
            this.#fadeProgress = 0.0
        }
    }

    setPlaybackRate(rate: number): void {
        this.#playbackRate = rate
    }

    process(bufferStart: int, bufferCount: int): void {
        const [outL, outR] = this.#output.channels()
        const {frames, numberOfFrames} = this.#data
        const framesL = frames[0]
        const framesR = frames.length === 1 ? frames[0] : frames[1]
        const fadeLength = this.#fadeLength
        const playbackRate = this.#playbackRate
        const fadeOutThreshold = numberOfFrames - fadeLength * playbackRate
        let state = this.#state
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
            readPosition += playbackRate
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