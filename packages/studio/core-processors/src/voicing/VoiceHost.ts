import {Voice} from "./Voice"
import {NoteEvent, ppqn} from "@opendaw/lib-dsp"

export interface VoiceHost {
    create(): Voice
    computeFrequency(event: NoteEvent): number
    glideTime(): ppqn
}