import {AudioPitchBoxAdapter} from "./AudioPitchBoxAdapter"
import {AudioTimeStretchBoxAdapter} from "./AudioTimeStretchBoxAdapter"

export namespace AudioPlayMode {
    export const isAudioPlayMode = (mode: unknown): mode is AudioPlayMode =>
        mode instanceof AudioPitchBoxAdapter || mode instanceof AudioTimeStretchBoxAdapter
}

export type AudioPlayMode = AudioPitchBoxAdapter | AudioTimeStretchBoxAdapter