import {Voice} from "./Voice"
import {VoiceFactory} from "./VoiceFactory"
import {Id, int} from "@opendaw/lib-std"
import {AudioBuffer, midiToHz, NoteEvent} from "@opendaw/lib-dsp"
import {Block} from "../processing"
import {VoicingStrategy} from "./VoicingStrategy"

export class SimpleStrategy<V extends Voice> implements VoicingStrategy {
    readonly #factory: VoiceFactory<V>
    readonly #voices: V[] = []

    constructor(factory: VoiceFactory<V>) {
        this.#factory = factory
    }

    start(event: Id<NoteEvent>, freqMult: number): void {
        const frequency = midiToHz(event.pitch + event.cent / 100.0, 440.0) * freqMult
        const voice = this.#factory.create()
        voice.start(event.id, frequency, event.velocity)
        voice.startGlide(frequency * 2, event.duration) // test glide
        this.#voices.push(voice)
    }

    stop(id: int): void {
        this.#voices.find(v => v.id === id)?.stop()
    }

    reset(): void {
        this.#voices.length = 0
    }

    process(output: AudioBuffer, block: Block, fromIndex: int, toIndex: int): void {
        output.clear(fromIndex, toIndex)
        for (let i = this.#voices.length - 1; i >= 0; i--) {
            if (this.#voices[i].process(output, block, fromIndex, toIndex))
                this.#voices.splice(i, 1)
        }
    }
}
