import {AudioPitchStretchBoxAdapter} from "./AudioPitchStretchBoxAdapter"
import {AudioTimeStretchBoxAdapter} from "./AudioTimeStretchBoxAdapter"

export namespace AudioPlayMode {
    export const isAudioPlayMode = (mode: unknown): mode is AudioPlayMode =>
        mode instanceof AudioPitchStretchBoxAdapter || mode instanceof AudioTimeStretchBoxAdapter
}

export type AudioPlayMode = AudioPitchStretchBoxAdapter | AudioTimeStretchBoxAdapter