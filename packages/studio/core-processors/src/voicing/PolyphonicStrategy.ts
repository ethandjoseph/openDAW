import {Arrays, Id, int} from "@opendaw/lib-std"
import {AudioBuffer, NoteEvent} from "@opendaw/lib-dsp"
import {Voice} from "./Voice"
import {VoicingHost} from "./VoicingHost"
import {VoicingStrategy} from "./VoicingStrategy"
import {Block} from "../processing"

export class PolyphonicStrategy implements VoicingStrategy {
    readonly #host: VoicingHost
    readonly #processing: Array<Voice> = []
    readonly #availableForGlide: Array<Voice> = []

    constructor(host: VoicingHost) {this.#host = host}

    start(event: Id<NoteEvent>): void {
        let lastFrequency: number = NaN
        for (let index = 0; index < this.#availableForGlide.length; index++) {
            const voice = this.#availableForGlide[index]
            if (!voice.gate) {
                lastFrequency = voice.currentFrequency
                this.#availableForGlide.splice(index, 1)
                break
            }
        }
        const voice = this.#host.create()
        if (isNaN(lastFrequency)) {
            voice.start(event.id, this.#host.computeFrequency(event), event.velocity)
        } else {
            voice.start(event.id, lastFrequency, event.velocity)
            voice.startGlide(this.#host.computeFrequency(event), this.#host.glideTime())
        }
        this.#availableForGlide.push(voice)
        this.#processing.push(voice)
    }

    stop(id: int): void {
        this.#processing.find(voice => voice.id === id)?.stop()
    }

    reset(): void {
        this.#processing.length = 0
        this.#availableForGlide.length = 0
    }

    process(output: AudioBuffer, block: Block, fromIndex: int, toIndex: int): void {
        output.clear(fromIndex, toIndex)
        for (let i = this.#processing.length - 1; i >= 0; i--) {
            const voice = this.#processing[i]
            if (voice.process(output, block, fromIndex, toIndex)) {
                Arrays.removeIf(this.#availableForGlide, voice => voice === voice)
                this.#processing.splice(i, 1)
            }
        }
    }
}