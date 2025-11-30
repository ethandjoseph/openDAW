import {int} from "@opendaw/lib-std"

export interface Voice {
    done(): boolean
    startFadeOut(): void
    process(bufferStart: int, bufferCount: int): void
}