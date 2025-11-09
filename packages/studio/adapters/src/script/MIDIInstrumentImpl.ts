import {UUID} from "@opendaw/lib-std"
import {MIDIInstrument, NoteTrack} from "./Api"
import {AudioUnitBox, TrackBox} from "@opendaw/studio-boxes"
import {NoteTrackImpl} from "./NoteTrackImpl"
import {ProjectSkeleton} from "../project/ProjectSkeleton"
import {InstrumentBox} from "../factories/InstrumentBox"
import {TrackType} from "../timeline/TrackType"

export class MIDIInstrumentImpl implements MIDIInstrument {
    readonly #skeleton: ProjectSkeleton
    // @ts-ignore
    readonly #instrumentBox: InstrumentBox
    readonly #audioUnitBox: AudioUnitBox

    constructor(skeleton: ProjectSkeleton, instrumentBox: InstrumentBox, audioUnitBox: AudioUnitBox) {
        this.#skeleton = skeleton
        this.#instrumentBox = instrumentBox
        this.#audioUnitBox = audioUnitBox
    }

    createNoteTrack(): NoteTrack {
        const {boxGraph} = this.#skeleton
        boxGraph.beginTransaction()
        const trackBox = TrackBox.create(boxGraph, UUID.generate(), box => {
            box.index.setValue(this.#audioUnitBox.tracks.pointerHub.size())
            box.type.setValue(TrackType.Notes)
            box.tracks.refer(this.#audioUnitBox.tracks)
            box.target.refer(this.#audioUnitBox)
        })
        boxGraph.endTransaction()
        return new NoteTrackImpl(this.#skeleton, trackBox)
    }
}