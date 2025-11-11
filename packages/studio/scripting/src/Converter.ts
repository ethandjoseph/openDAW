import {InstrumentAudioUnitImpl, NoteTrackImpl, ProjectImpl} from "./impl"
import {AudioUnitFactory, CaptureBox, InstrumentFactories, ProjectSkeleton, TrackType} from "@opendaw/studio-adapters"
import {AudioUnitType} from "@opendaw/studio-enums"
import {Option, UUID} from "@opendaw/lib-std"
import {TrackBox} from "@opendaw/studio-boxes"

export namespace Converter {
    export const toSkeleton = (project: ProjectImpl): ProjectSkeleton => {
        const skeleton = ProjectSkeleton.empty({
            createDefaultUser: true,
            createOutputCompressor: false
        })
        const {boxGraph, mandatoryBoxes: {timelineBox}} = skeleton
        boxGraph.beginTransaction()
        timelineBox.bpm.setValue(project.tempo)
        project.getInstrumentUnits().forEach((audioUnit: InstrumentAudioUnitImpl) => {
            const factory = InstrumentFactories.Named[audioUnit.instrument.name]
            const capture: Option<CaptureBox> = AudioUnitFactory.trackTypeToCapture(boxGraph, factory.trackType)
            const audioUnitBox = AudioUnitFactory.create(skeleton, AudioUnitType.Instrument, capture)
            factory.create(boxGraph, audioUnitBox.input, factory.defaultName, factory.defaultIcon)
            let trackIndex = 0
            audioUnit.getNoteTracks().forEach((noteTrack: NoteTrackImpl) => {
                TrackBox.create(boxGraph, UUID.generate(), box => {
                    box.type.setValue(TrackType.Notes)
                    box.enabled.setValue(noteTrack.enabled)
                    box.index.setValue(trackIndex++)
                    box.target.refer(audioUnitBox)
                    box.tracks.refer(audioUnitBox.tracks)
                })
            })
        })
        boxGraph.endTransaction()
        return skeleton
    }
}