import {Arrays, asInstanceOf, isDefined, Option} from "@opendaw/lib-std"
import {AudioUnitType} from "@opendaw/studio-enums"
import {AudioRegionBox, AudioUnitBox, BoxVisitor, TrackBox} from "@opendaw/studio-boxes"
import {
    AudioUnitFactory,
    CaptureBox,
    InstrumentFactories,
    ProjectSkeleton,
    UnionBoxTypes
} from "@opendaw/studio-adapters"
import {InstrumentAudioUnitImpl, ProjectImpl} from "./impl"
import {NoteTrackWriter} from "./NoteTrackWriter"
import {ValueTrackWriter} from "./ValueTrackWriter"
import {AnyDevice} from "./Api"
import {Box, BoxGraph} from "@opendaw/lib-box"
import {MIDIEffectFactory} from "./MIDIEffectFactory"
import {AudioEffectFactory} from "./AudioEffectFactory"
import {TimeBase} from "@opendaw/lib-dsp"

export namespace ProjectConverter {
    export const toSkeleton = (project: ProjectImpl): ProjectSkeleton => {
        console.time("convert")
        const skeleton = ProjectSkeleton.empty({
            createDefaultUser: true,
            createOutputCompressor: false
        })
        const {boxGraph, mandatoryBoxes: {rootBox, timelineBox, userInterfaceBoxes: [defaultUser]}} = skeleton
        let trackIndex = 0
        const devices: Map<AnyDevice, Box> = new Map()
        const noteTrackWriter = new NoteTrackWriter(boxGraph, () => trackIndex++)
        const valueTrackWriter = new ValueTrackWriter(boxGraph, devices, () => trackIndex++)
        boxGraph.beginTransaction()
        // TODO clamp or throw on invalid values
        timelineBox.bpm.setValue(project.bpm)
        timelineBox.signature.nominator.setValue(project.timeSignature.numerator)
        timelineBox.signature.denominator.setValue(project.timeSignature.denominator)
        project.instrumentUnits.forEach((audioUnit: InstrumentAudioUnitImpl) => {
            const {
                instrument, midiEffects, audioEffects, noteTracks, valueTracks,
                volume, panning, mute, solo
            } = audioUnit
            const factory = InstrumentFactories.Named[instrument.name]
            const capture: Option<CaptureBox> = AudioUnitFactory.trackTypeToCapture(boxGraph, factory.trackType)
            const audioUnitBox = AudioUnitFactory.create(skeleton, AudioUnitType.Instrument, capture)
            devices.set(audioUnit, audioUnitBox)
            audioUnitBox.mute.setValue(mute)
            audioUnitBox.solo.setValue(solo)
            audioUnitBox.volume.setValue(volume)
            audioUnitBox.panning.setValue(panning)
            factory.create(boxGraph, audioUnitBox.input, factory.defaultName, factory.defaultIcon)
            midiEffects.forEach((effect) => devices.set(effect, MIDIEffectFactory.write(boxGraph, audioUnitBox, effect)))
            audioEffects.forEach((effect) => devices.set(effect, AudioEffectFactory.write(boxGraph, audioUnitBox, effect)))
            noteTrackWriter.write(audioUnitBox, noteTracks)
            valueTrackWriter.write(audioUnitBox, valueTracks)
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
        console.timeEnd("convert")
        if (hasOverlappingRegions(boxGraph)) {
            throw new Error("Project contains overlapping regions")
        }
        return skeleton
    }

    const hasOverlappingRegions = (boxGraph: BoxGraph): boolean => boxGraph.boxes()
        .some(box => box.accept<BoxVisitor<boolean>>({
            visitTrackBox: (box: TrackBox): boolean => {
                for (const [current, next] of Arrays.iterateAdjacent(box.regions.pointerHub.incoming()
                    .map(({box}) => UnionBoxTypes.asRegionBox(box))
                    .sort(({position: a}, {position: b}) => a.getValue() - b.getValue()))) {
                    if (current instanceof AudioRegionBox && current.timeBase.getValue() === TimeBase.Seconds) {
                        return false
                    }
                    if (current.position.getValue() + current.duration.getValue() > next.position.getValue()) {
                        return true
                    }
                }
                return false
            }
        }) ?? false)
}