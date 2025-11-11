import {asInstanceOf, isDefined, Option, Unhandled, UUID} from "@opendaw/lib-std"
import {AudioUnitType} from "@opendaw/studio-enums"
import {
    AudioUnitBox,
    NoteEventBox,
    NoteEventCollectionBox,
    NoteRegionBox,
    PitchDeviceBox,
    TrackBox
} from "@opendaw/studio-boxes"
import {AudioUnitFactory, CaptureBox, InstrumentFactories, ProjectSkeleton, TrackType} from "@opendaw/studio-adapters"
import {InstrumentAudioUnitImpl, NoteRegionImpl, NoteTrackImpl, ProjectImpl} from "./impl"

export namespace Converter {
    export const toSkeleton = (project: ProjectImpl): ProjectSkeleton => {
        const skeleton = ProjectSkeleton.empty({
            createDefaultUser: true,
            createOutputCompressor: false
        })
        const {boxGraph, mandatoryBoxes: {rootBox, timelineBox, userInterfaceBoxes: [defaultUser]}} = skeleton
        boxGraph.beginTransaction()
        timelineBox.bpm.setValue(project.tempo)
        project.getInstrumentUnits().forEach((audioUnit: InstrumentAudioUnitImpl) => {
            const factory = InstrumentFactories.Named[audioUnit.instrument.name]
            const capture: Option<CaptureBox> = AudioUnitFactory.trackTypeToCapture(boxGraph, factory.trackType)
            const audioUnitBox = AudioUnitFactory.create(skeleton, AudioUnitType.Instrument, capture)
            factory.create(boxGraph, audioUnitBox.input, factory.defaultName, factory.defaultIcon)

            audioUnitBox.mute.setValue(audioUnit.isMuted())
            audioUnitBox.solo.setValue(audioUnit.isSolo())
            // TODO audioUnitBox.panning.setValue(audioUnit.getPan())

            audioUnit.midiEffects.forEach((effect) => {
                switch (effect.key) {
                    case "pitch": {
                        return PitchDeviceBox.create(boxGraph, UUID.generate(), box => {
                            box.cents.setValue(effect.cents)
                            box.semiTones.setValue(effect.semiTones)
                            box.octaves.setValue(effect.octaves)
                            box.enabled.setValue(effect.enabled)
                            box.label.setValue(effect.label) // TODO unify?
                            box.host.refer(audioUnitBox.midiEffects)
                        })
                    }
                    default:
                        return Unhandled(effect.key)
                }
            })

            let trackIndex = 0
            audioUnit.noteTracks.forEach(({enabled, regions}: NoteTrackImpl) => {
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
        // select the first audio unit as the editing device
        const firstAudioUnitBox = rootBox.audioUnits.pointerHub.incoming()
            .map(({box}) => asInstanceOf(box, AudioUnitBox))
            .sort(({index: a}, {index: b}) => a.getValue() - b.getValue())
            .at(0)
        if (isDefined(firstAudioUnitBox)) {
            defaultUser.editingDeviceChain.refer(firstAudioUnitBox.editing)
        }
        boxGraph.endTransaction()
        return skeleton
    }
}