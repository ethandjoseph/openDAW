import {int, unitValue} from "@opendaw/lib-std"
import {ppqn} from "@opendaw/lib-dsp"
import {Block} from "../processing"

export interface Voice {
    active: boolean
    note: int
    velocity: unitValue
    gate: boolean

    start(note: int, velocity: unitValue): void
    stop(note: int): void
    forceStop(): void
    startGlide(targetNote: int, glideDuration: ppqn): void
    processAudio(block: Block, fromIndex: int, toIndex: int): boolean
}