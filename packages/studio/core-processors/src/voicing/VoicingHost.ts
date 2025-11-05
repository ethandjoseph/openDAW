import {Voice} from "./Voice"
import {NoteEvent, ppqn} from "@opendaw/lib-dsp"

export interface VoicingHost {
    create(): Voice
    computeFrequency(event: NoteEvent): number
    frequencyMultiplier(): number
    glideTime(): ppqn
}