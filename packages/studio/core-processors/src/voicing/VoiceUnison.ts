import {Voice} from "./Voice"
import {int, Provider, unitValue} from "@opendaw/lib-std"
import {AudioBuffer, PPQN, ppqn} from "@opendaw/lib-dsp"
import {Block} from "../processing"

export class VoiceUnison implements Voice {
    readonly #voiceFactory: Provider<Voice>
    readonly #running: Array<{ voice: Voice, freqMult: number }> = []
    readonly #numVoices: int
    readonly #detune: number

    beginFrequency: number = NaN
    currentFrequency: number = NaN
    gate: boolean = true
    id: int = -1
    targetFrequency: number = NaN
    glidePosition: unitValue = 0.0
    glideDuration: ppqn = 0.0

    constructor(voiceFactory: Provider<Voice>, numVoices: int, detune: number) {
        this.#voiceFactory = voiceFactory
        this.#numVoices = numVoices
        this.#detune = detune
    }

    start(id: int, frequency: number, velocity: unitValue, _panning: number = 0.0): void {
        this.id = id
        this.currentFrequency = this.beginFrequency = frequency

        if (this.#numVoices === 1) {
            const voice = this.#voiceFactory()
            voice.start(id, frequency, velocity / this.#numVoices, 0.0)
            this.#running.push({voice, freqMult: 1.0})
        } else {
            for (let i = 0; i < this.#numVoices; ++i) {
                const spread = this.#numVoices === 1 ? 0.0 : i / (this.#numVoices - 1) * 2.0 - 1.0 // [-1...+1]
                const voice = this.#voiceFactory()
                const freqMult = 2.0 ** (spread * (this.#detune / 1200.0))
                voice.start(id, frequency * freqMult, velocity / this.#numVoices, spread)
                this.#running.push({voice, freqMult})
            }
        }
    }

    startGlide(targetFrequency: number, glideDuration: ppqn): void {
        this.targetFrequency = targetFrequency
        this.glideDuration = glideDuration
        this.glidePosition = 0.0
        this.#running.forEach(({voice, freqMult}) => voice.startGlide(targetFrequency * freqMult, glideDuration))
    }

    process(output: AudioBuffer, block: Block, fromIndex: int, toIndex: int): boolean {
        if (isNaN(this.targetFrequency)) {
            this.currentFrequency = this.beginFrequency
        } else {
            const ppqnDelta = PPQN.samplesToPulses(toIndex - fromIndex, block.bpm, sampleRate)
            this.glidePosition += ppqnDelta / this.glideDuration
            if (this.glidePosition >= 1.0) {
                this.glidePosition = 1.0
                this.beginFrequency = this.currentFrequency = this.targetFrequency
                this.targetFrequency = NaN
            } else {
                this.currentFrequency =
                    this.beginFrequency + (this.targetFrequency - this.beginFrequency) * this.glidePosition
            }
        }
        for (let i = this.#running.length - 1; i >= 0; i--) {
            const voice = this.#running[i].voice
            if (voice.process(output, block, fromIndex, toIndex)) {
                this.#running.splice(i, 1)
            }
        }
        return this.#running.length === 0
    }

    stop(): void {
        this.#running.forEach(({voice}) => voice.stop())
        this.gate = false
    }

    forceStop(): void {
        this.#running.forEach(({voice}) => voice.forceStop())
        this.gate = false
    }
}