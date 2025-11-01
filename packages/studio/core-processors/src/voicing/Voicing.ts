import {Voice} from "./Voice"
import {VoiceFactory} from "./VoiceFactory"
import {Id, int} from "@opendaw/lib-std"
import {AudioBuffer, midiToHz, NoteEvent} from "@opendaw/lib-dsp"
import {Block} from "../processing"

export class Voicing<V extends Voice> {
    readonly #factory: VoiceFactory<V>
    readonly #voices: V[] = []

    constructor(factory: VoiceFactory<V>) {
        this.#factory = factory
    }

    start(event: Id<NoteEvent>, freqMult: number): void {
        const frequency = midiToHz(event.pitch + event.cent / 100.0, 440.0) * freqMult

        // TODO This needs to go into the stratgy (we may not even create a new voice...)
        const voice = this.#factory.create()
        voice.start(event.id, frequency, event.velocity)
        voice.startGlide(frequency * 2, event.duration) // Just a test
        this.#voices.push(voice)
    }

    stop(id: int) {this.#voices.find(voice => voice.id === id)?.stop()}

    reset(): void {this.#voices.length = 0}

    process(audioOutput: AudioBuffer, block: Block, fromIndex: int, toIndex: int) {
        audioOutput.clear(fromIndex, toIndex)
        for (let i = this.#voices.length - 1; i >= 0; i--) {
            if (this.#voices[i].process(audioOutput, block, fromIndex, toIndex)) {
                this.#voices.splice(i, 1)
            }
        }
    }
}