import {Voice} from "./Voice"
import {int, Provider, unitValue} from "@opendaw/lib-std"
import {AudioBuffer, Glide, ppqn} from "@opendaw/lib-dsp"
import {Block} from "../processing"

export class VoiceUnison implements Voice {
    readonly #voiceFactory: Provider<Voice>
    readonly #running: Array<{ voice: Voice, detune: number }> = []
    readonly #glide: Glide = new Glide()
    readonly #numVoices: int
    readonly #detune: number

    gate: boolean = true
    id: int = -1

    constructor(voiceFactory: Provider<Voice>, numVoices: int, detune: number) {
        this.#voiceFactory = voiceFactory
        this.#numVoices = numVoices
        this.#detune = detune
    }

    get currentFrequency(): number {return this.#glide.currentFrequency()}

    start(id: int, frequency: number, velocity: unitValue, gain: number, panning: number): void {
        this.id = id
        this.#glide.start(frequency)
        if (this.#numVoices === 1) {
            const voice = this.#voiceFactory()
            voice.start(id, frequency, velocity, gain, panning)
            this.#running.push({voice, detune: 1.0})
        } else {
            for (let index = 0; index < this.#numVoices; ++index) {
                const spread = index / (this.#numVoices - 1) * 2.0 - 1.0 // [-1...+1]
                const voice = this.#voiceFactory()
                const detune = 2.0 ** (spread * (this.#detune / 1200.0))
                const voicePanning = (1.0 - Math.abs(panning)) * spread + panning // pushes the voice to the left or right
                voice.start(id, frequency * detune, velocity, gain / Math.sqrt(this.#numVoices), voicePanning)
                this.#running.push({voice, detune})
            }
        }
    }

    startGlide(targetFrequency: number, glideDuration: ppqn): void {
        this.#glide.glideTo(targetFrequency, glideDuration)
        this.#running.forEach(({voice, detune}) => voice.startGlide(targetFrequency * detune, glideDuration))
    }

    process(output: AudioBuffer, block: Block, fromIndex: int, toIndex: int): boolean {
        this.#glide.advance(block.bpm, fromIndex, toIndex)
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