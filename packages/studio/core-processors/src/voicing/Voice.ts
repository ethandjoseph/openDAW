import {int, unitValue} from "@opendaw/lib-std"
import {AudioBuffer, ppqn} from "@opendaw/lib-dsp"
import {Block} from "../processing"

export interface Voice {
    readonly id: int
    readonly gate: boolean
    readonly currentFrequency: number

    start(id: int, frequency: number, velocity: unitValue): void
    stop(): void
    forceStop(): void
    startGlide(targetFrequency: number, glideDuration: ppqn): void
    process(output: AudioBuffer, block: Block, fromIndex: int, toIndex: int): boolean
}