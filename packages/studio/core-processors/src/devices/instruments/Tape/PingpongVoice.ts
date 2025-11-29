import {int} from "@opendaw/lib-std"
import {AudioBuffer, AudioData} from "@opendaw/lib-dsp"
import {Segment} from "./Segment"
import {VoiceState} from "./VoiceState"
import {Voice} from "./Voice"
import {LOOP_END_MARGIN, LOOP_START_MARGIN} from "./constants"

export class PingpongVoice implements Voice {
    readonly #output: AudioBuffer
    readonly #data: AudioData
    readonly #segment: Segment
    readonly #fadeLength: number
    readonly #loopStart: number
    readonly #loopEnd: number
    readonly #bounceFadeLength: number = 256

    #state: VoiceState = VoiceState.Fading
    #readPosition: number
    #fadeProgress: number = 0.0
    #fadeDirection: number = 1.0
    #direction: number = 1.0
    #bouncing: boolean = false
    #bounceFadeProgress: number = 0.0
    #bounceReadPosition: number = 0.0
    #bounceDirection: number = 1.0

    constructor(output: AudioBuffer, data: AudioData, segment: Segment, fadeLength: number, offset: number = 0.0) {
        this.#output = output
        this.#data = data
        this.#segment = segment
        this.#fadeLength = fadeLength
        this.#loopStart = segment.start + LOOP_START_MARGIN
        this.#loopEnd = segment.end - LOOP_END_MARGIN
        this.#readPosition = segment.start + offset
        if (this.#readPosition >= segment.end) {
            this.#state = VoiceState.Done
        }
    }

    done(): boolean {return this.#state === VoiceState.Done}

    startFadeOut(): void {
        if (this.#state === VoiceState.Done) {return}
        if (this.#state === VoiceState.Active) {
            this.#state = VoiceState.Fading
            this.#fadeProgress = this.#fadeLength
        }
        this.#fadeDirection = -1.0
    }

    process(bufferStart: int, bufferCount: int): void {
        const [outL, outR] = this.#output.channels()
        const {frames, numberOfFrames} = this.#data
        const framesL = frames[0]
        const framesR = frames.length === 1 ? frames[0] : frames[1]
        const fadeLength = this.#fadeLength
        const loopStart = this.#loopStart
        const loopEnd = this.#loopEnd
        const bounceFadeLength = this.#bounceFadeLength
        const bounceCrossfadeStartForward = loopEnd - bounceFadeLength
        const bounceCrossfadeStartBackward = loopStart + bounceFadeLength
        let state = this.#state
        let readPosition = this.#readPosition
        let fadeProgress = this.#fadeProgress
        let fadeDirection = this.#fadeDirection
        let direction = this.#direction
        let bouncing = this.#bouncing
        let bounceFadeProgress = this.#bounceFadeProgress
        let bounceReadPosition = this.#bounceReadPosition
        let bounceDirection = this.#bounceDirection
        for (let i = 0; i < bufferCount; i++) {
            if (state === VoiceState.Done) {break}
            const j = bufferStart + i
            let amplitude: number
            if (state === VoiceState.Fading) {
                amplitude = fadeProgress / fadeLength
                fadeProgress += fadeDirection
                if (fadeProgress >= fadeLength) {
                    state = VoiceState.Active
                } else if (fadeProgress <= 0.0) {
                    state = VoiceState.Done
                    break
                }
            } else {
                amplitude = 1.0
            }
            // Read primary sample
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
            // Check if we should start bounce crossfade
            if (!bouncing) {
                if (direction > 0.0 && readPosition >= bounceCrossfadeStartForward) {
                    bouncing = true
                    bounceFadeProgress = 0.0
                    bounceReadPosition = loopEnd
                    bounceDirection = -1.0
                } else if (direction < 0.0 && readPosition <= bounceCrossfadeStartBackward) {
                    bouncing = true
                    bounceFadeProgress = 0.0
                    bounceReadPosition = loopStart
                    bounceDirection = 1.0
                }
            }
            // Handle bounce crossfade
            if (bouncing) {
                const bounceReadInt = bounceReadPosition | 0
                if (bounceReadInt >= 0 && bounceReadInt < numberOfFrames - 1) {
                    const alpha = bounceReadPosition - bounceReadInt
                    const bsL = framesL[bounceReadInt]
                    const bsR = framesR[bounceReadInt]
                    const bounceSampleL = bsL + alpha * (framesL[bounceReadInt + 1] - bsL)
                    const bounceSampleR = bsR + alpha * (framesR[bounceReadInt + 1] - bsR)
                    const t = bounceFadeProgress / bounceFadeLength
                    const crossfadeOut = Math.cos(t * Math.PI * 0.5)
                    const crossfadeIn = Math.sin(t * Math.PI * 0.5)
                    sampleL = sampleL * crossfadeOut + bounceSampleL * crossfadeIn
                    sampleR = sampleR * crossfadeOut + bounceSampleR * crossfadeIn
                }
                bounceFadeProgress += 1.0
                bounceReadPosition += bounceDirection
                if (bounceFadeProgress >= bounceFadeLength) {
                    readPosition = bounceReadPosition
                    direction = bounceDirection
                    bouncing = false
                }
            }
            outL[j] += sampleL * amplitude
            outR[j] += sampleR * amplitude
            readPosition += direction
        }
        this.#state = state
        this.#readPosition = readPosition
        this.#fadeProgress = fadeProgress
        this.#fadeDirection = fadeDirection
        this.#direction = direction
        this.#bouncing = bouncing
        this.#bounceFadeProgress = bounceFadeProgress
        this.#bounceReadPosition = bounceReadPosition
        this.#bounceDirection = bounceDirection
    }
}