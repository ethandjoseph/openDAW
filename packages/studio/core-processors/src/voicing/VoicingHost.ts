import {Voice} from "./Voice"
import {NoteEvent, ppqn} from "@opendaw/lib-dsp"

export interface VoicingHost {
    create(): Voice
    computeFrequency(event: NoteEvent): number
    glideTime(): ppqn
}