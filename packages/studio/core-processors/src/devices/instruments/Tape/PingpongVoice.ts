import {int} from "@opendaw/lib-std"
import {AudioBuffer, AudioData} from "@opendaw/lib-dsp"
import {Segment} from "./Segment"
import {VoiceState} from "./VoiceState"
import {Voice} from "./Voice"
import {LOOP_END_MARGIN, LOOP_START_MARGIN} from "./constants"

const BOUNCE_FADE_LENGTH = 256

export class PingpongVoice implements Voice {
    readonly #output: AudioBuffer
    readonly #data: AudioData
    readonly #fadeLength: number
    readonly #loopStart: number
    readonly #loopEnd: number

    #state: VoiceState = VoiceState.Fading
    #readPosition: number
    #fadeProgress: number = 0.0
    #fadeDirection: number = 1.0
    #direction: number = 1.0
    #bounceProgress: number = 0.0
    #bouncePosition: number = 0.0

    constructor(output: AudioBuffer, data: AudioData, segment: Segment, fadeLength: number, offset: number = 0.0) {
        console.debug("offset", offset)
        this.#output = output
        this.#data = data
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
        const bounceStart = loopEnd - BOUNCE_FADE_LENGTH
        const bounceEnd = loopStart + BOUNCE_FADE_LENGTH
        let state = this.#state
        let readPosition = this.#readPosition
        let fadeProgress = this.#fadeProgress
        let fadeDirection = this.#fadeDirection
        let direction = this.#direction
        let bounceProgress = this.#bounceProgress
        let bouncePosition = this.#bouncePosition
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
            // Start bounce crossfade when approaching boundaries
            if (bounceProgress === 0.0) {
                if (direction > 0.0 && readPosition >= bounceStart) {
                    bounceProgress = 1.0
                    bouncePosition = loopEnd
                } else if (direction < 0.0 && readPosition <= bounceEnd) {
                    bounceProgress = 1.0
                    bouncePosition = loopStart
                }
            }
            // Apply bounce crossfade
            if (bounceProgress > 0.0) {
                const bounceInt = bouncePosition | 0
                if (bounceInt >= 0 && bounceInt < numberOfFrames - 1) {
                    const alpha = bouncePosition - bounceInt
                    const bL = framesL[bounceInt]
                    const bR = framesR[bounceInt]
                    const bounceSampleL = bL + alpha * (framesL[bounceInt + 1] - bL)
                    const bounceSampleR = bR + alpha * (framesR[bounceInt + 1] - bR)
                    const t = bounceProgress / BOUNCE_FADE_LENGTH
                    const fadeOut = Math.cos(t * Math.PI * 0.5)
                    const fadeIn = Math.sin(t * Math.PI * 0.5)
                    sampleL = sampleL * fadeOut + bounceSampleL * fadeIn
                    sampleR = sampleR * fadeOut + bounceSampleR * fadeIn
                }
                bouncePosition -= direction
                bounceProgress += 1.0
                if (bounceProgress >= BOUNCE_FADE_LENGTH) {
                    readPosition = bouncePosition
                    direction = -direction
                    bounceProgress = 0.0
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
        this.#bounceProgress = bounceProgress
        this.#bouncePosition = bouncePosition
    }
}