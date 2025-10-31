import {AudioUnitBox, TrackBox} from "@opendaw/studio-boxes"
import {InstrumentBox} from "./InstrumentBox"

export type InstrumentProduct<INST extends InstrumentBox> = {
    audioUnitBox: AudioUnitBox
    instrumentBox: INST
    trackBox: TrackBox
}