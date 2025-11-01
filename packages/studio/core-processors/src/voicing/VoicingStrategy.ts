import {Id, int} from "@opendaw/lib-std"
import {AudioBuffer, NoteEvent} from "@opendaw/lib-dsp"
import {Block} from "../processing"

export interface VoicingStrategy {
    start(event: Id<NoteEvent>, freqMult: number): void
    stop(id: int): void
    process(output: AudioBuffer, block: Block, fromIndex: int, toIndex: int): void
    reset(): void
}