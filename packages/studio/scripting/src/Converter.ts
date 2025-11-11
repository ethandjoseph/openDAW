import {InstrumentAudioUnitImpl, NoteRegionImpl, NoteTrackImpl, ProjectImpl} from "./impl"
import {AudioUnitFactory, CaptureBox, InstrumentFactories, ProjectSkeleton, TrackType} from "@opendaw/studio-adapters"
import {AudioUnitType} from "@opendaw/studio-enums"
import {Option, UUID} from "@opendaw/lib-std"
import {NoteEventBox, NoteEventCollectionBox, NoteRegionBox, TrackBox} from "@opendaw/studio-boxes"

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
            audioUnit.getNoteTracks().forEach(({enabled, regions}: NoteTrackImpl) => {
                const trackBox = TrackBox.create(boxGraph, UUID.generate(), box => {
                    box.type.setValue(TrackType.Notes)
                    box.enabled.setValue(enabled)
                    box.index.setValue(trackIndex++)
                    box.target.refer(audioUnitBox)
                    box.tracks.refer(audioUnitBox.tracks)
                })
                regions.forEach(({
                                     position, duration, loopDuration, loopOffset,
                                     events, hue, label, mute
                                 }: NoteRegionImpl) => {
                    const noteEventCollectionBox = NoteEventCollectionBox.create(boxGraph, UUID.generate())
                    events.forEach(event => {
                        NoteEventBox.create(boxGraph, UUID.generate(), box => {
                            box.position.setValue(event.position)
                            box.duration.setValue(event.duration)
                            box.pitch.setValue(event.pitch)
                            box.cent.setValue(event.cents) // TODO rename to plural
                            box.velocity.setValue(event.velocity)
                            box.events.refer(noteEventCollectionBox.events)
                        })
                    })
                    NoteRegionBox.create(boxGraph, UUID.generate(), box => {
                        box.position.setValue(position)
                        box.duration.setValue(duration)
                        box.loopDuration.setValue(loopDuration)
                        box.loopOffset.setValue(loopOffset)
                        box.hue.setValue(hue)
                        box.label.setValue(label)
                        box.eventOffset.setValue(0) // TODO
                        box.mute.setValue(mute)
                        box.regions.refer(trackBox.regions)
                        box.events.refer(noteEventCollectionBox.owners)
                    })
                })
            })
        })
        boxGraph.endTransaction()
        return skeleton
    }
}