import {EmptyExec, Id, int, panic} from "@opendaw/lib-std"
import {AudioBuffer, NoteEvent} from "@opendaw/lib-dsp"
import {Block} from "../processing"

export interface VoicingStrategy {
    start(event: Id<NoteEvent>): void
    stop(id: int): void
    process(output: AudioBuffer, block: Block, fromIndex: int, toIndex: int): void
    reset(): void
}

export namespace VoicingStrategy {
    export const NotSet: VoicingStrategy = {
        start: () => panic("VoicingStrategy.start"),
        stop: () => panic("VoicingStrategy.stop"),
        process: () => panic("VoicingStrategy.process"),
        reset: EmptyExec
    }
}