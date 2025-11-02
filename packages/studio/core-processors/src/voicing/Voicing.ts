import {Id, int} from "@opendaw/lib-std"
import {AudioBuffer, NoteEvent} from "@opendaw/lib-dsp"
import {Block} from "../processing"
import {VoicingStrategy} from "./VoicingStrategy"

export class Voicing {
    #strategy: VoicingStrategy

    constructor(strategy: VoicingStrategy = VoicingStrategy.NotSet) {
        this.#strategy = strategy
    }

    set strategy(strategy: VoicingStrategy) {
        this.#strategy.reset()
        this.#strategy = strategy
    }

    get strategy(): VoicingStrategy {return this.#strategy}

    start(event: Id<NoteEvent>): void {
        this.#strategy.start(event)
    }

    stop(id: int): void {
        this.#strategy.stop(id)
    }

    process(output: AudioBuffer, block: Block, fromIndex: int, toIndex: int): void {
        this.#strategy.process(output, block, fromIndex, toIndex)
    }

    reset(): void {
        this.#strategy.reset()
    }
}