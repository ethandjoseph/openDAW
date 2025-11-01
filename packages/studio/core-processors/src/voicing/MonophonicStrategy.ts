import {Id, int, isDefined, Nullable} from "@opendaw/lib-std"
import {AudioBuffer, midiToHz, NoteEvent, PPQN} from "@opendaw/lib-dsp"
import {Voice} from "./Voice"
import {VoiceFactory} from "./VoiceFactory"
import {VoicingStrategy} from "./VoicingStrategy"
import {Block} from "../processing"

export class MonophonicStrategy implements VoicingStrategy {
    readonly #factory: VoiceFactory
    readonly #voices: Voice[] = []
    readonly #held: Id<NoteEvent>[] = []

    #activeVoice: Nullable<Voice> = null

    constructor(factory: VoiceFactory) {this.#factory = factory}

    start(event: Id<NoteEvent>, freqMult: number): void {
        this.#held.push(event)

        const frequency = midiToHz(event.pitch + event.cent / 100.0, 440.0) * freqMult
        if (isDefined(this.#activeVoice)) {
            if (this.#activeVoice.gate) {
                this.#activeVoice.startGlide(frequency, PPQN.Quarter)
                return
            }
            this.#activeVoice.forceStop()
        }
        const voice = this.#factory.create()
        voice.start(event.id, frequency, event.velocity)
        this.#voices.push(voice)
        this.#activeVoice = voice
    }

    stop(id: int): void {
        const index = this.#held.findIndex(e => e.id === id)
        if (index === -1) return
        this.#held.splice(index, 1)

        if (!isDefined(this.#activeVoice)) return

        // released the topmost key and glide back if another note held
        if (index === this.#held.length) {
            const prev = this.#held.at(-1)
            if (isDefined(prev)) {
                const targetFreq = midiToHz(prev.pitch + prev.cent / 100.0, 440.0)
                this.#activeVoice.startGlide(targetFreq, PPQN.Quarter)
                return
            }
        }
        if (this.#held.length === 0) {
            this.#activeVoice.stop()
            this.#activeVoice = null
        }
    }

    reset(): void {
        this.#held.length = 0
        this.#voices.length = 0
        this.#activeVoice = null
    }

    process(output: AudioBuffer, block: Block, fromIndex: int, toIndex: int): void {
        output.clear(fromIndex, toIndex)
        for (let i = this.#voices.length - 1; i >= 0; i--) {
            const voice = this.#voices[i]
            if (voice.process(output, block, fromIndex, toIndex)) {
                if (voice === this.#activeVoice) {this.#activeVoice = null}
                this.#voices.splice(i, 1)
            }
        }
    }
}