import {asDefined, isDefined, Option, UUID} from "@opendaw/lib-std"
import {Box} from "@opendaw/lib-box"
import {AudioUnitType, IconSymbol} from "@opendaw/studio-enums"
import {AudioBusBox, AudioUnitBox, TrackBox} from "@opendaw/studio-boxes"
import {AudioUnitFactory, CaptureBox, InstrumentFactories, ProjectSkeleton} from "@opendaw/studio-adapters"
import {InstrumentAudioUnitImpl} from "./InstrumentAudioUnitImpl"
import {ProjectImpl} from "./ProjectImpl"
import {MIDIEffectFactory} from "../MIDIEffectFactory"
import {AudioEffectFactory} from "../AudioEffectFactory"
import {NoteTrackWriter} from "../NoteTrackWriter"
import {ValueTrackWriter} from "../ValueTrackWriter"
import {AnyDevice, AudioUnit} from "../Api"

export class AudioUnitBoxFactory {
    readonly #skeleton: ProjectSkeleton
    readonly #project: ProjectImpl

    #audioUnitIndex: int = 0

    constructor(skeleton: ProjectSkeleton, project: ProjectImpl) {
        this.#skeleton = skeleton
        this.#project = project
    }

    create(): void {
        const {boxGraph, mandatoryBoxes: {rootBox, primaryAudioBus, primaryAudioOutputUnit}} = this.#skeleton

        const devices: Map<AnyDevice, Box> = new Map()
        const busMap: Map<AudioUnit, AudioBusBox> = new Map([[this.#project.output, primaryAudioBus]])
        const audioUnitMap: Map<AudioUnit, AudioUnitBox> = new Map([[this.#project.output, primaryAudioOutputUnit]])
        this.#project.instrumentUnits.forEach((audioUnit: InstrumentAudioUnitImpl) => {
            const {
                instrument, midiEffects, audioEffects, noteTracks, valueTracks,
                volume, panning, mute, solo
            } = audioUnit
            let trackIndex = 0
            const noteTrackWriter = new NoteTrackWriter(boxGraph, () => trackIndex++)
            const valueTrackWriter = new ValueTrackWriter(boxGraph, devices, () => trackIndex++)
            const factory = InstrumentFactories.Named[instrument.name]
            const capture: Option<CaptureBox> = AudioUnitFactory.trackTypeToCapture(boxGraph, factory.trackType)
            const audioUnitBox = AudioUnitFactory.create(this.#skeleton, AudioUnitType.Instrument, capture)
            devices.set(audioUnit, audioUnitBox)
            audioUnitBox.index.setValue(this.#audioUnitIndex++)
            audioUnitBox.mute.setValue(mute)
            audioUnitBox.solo.setValue(solo)
            audioUnitBox.volume.setValue(volume)
            audioUnitBox.panning.setValue(panning)
            factory.create(boxGraph, audioUnitBox.input, factory.defaultName, factory.defaultIcon)
            midiEffects.forEach((effect) => devices.set(effect, MIDIEffectFactory.write(boxGraph, audioUnitBox, effect)))
            audioEffects.forEach((effect) => devices.set(effect, AudioEffectFactory.write(boxGraph, audioUnitBox, effect)))
            noteTrackWriter.write(audioUnitBox, noteTracks)
            valueTrackWriter.write(audioUnitBox, valueTracks)
            if (trackIndex === 0) { // create a default track if none exists
                TrackBox.create(boxGraph, UUID.generate(), box => {
                    box.type.setValue(factory.trackType)
                    box.index.setValue(0)
                    box.target.refer(audioUnitBox)
                    box.tracks.refer(audioUnitBox.tracks)
                })
            }
            audioUnitMap.set(audioUnit, audioUnitBox)
        })
        this.#project.groupUnits.forEach(groupUnit => {
            const audioBusBox = AudioBusBox.create(boxGraph, UUID.generate(), box => {
                box.collection.refer(rootBox.audioBusses)
                box.label.setValue(groupUnit.label)
                box.icon.setValue(IconSymbol.toName(IconSymbol.AudioBus))
                box.color.setValue("var(--color-orange)") // TODO Colors need to be in code and written to CSS
            })
            const audioUnitBox = AudioUnitBox.create(boxGraph, UUID.generate(), box => {
                box.type.setValue(AudioUnitType.Bus)
                box.collection.refer(rootBox.audioUnits)
                box.index.setValue(this.#audioUnitIndex++)
            })
            busMap.set(groupUnit, audioBusBox)
            audioUnitMap.set(groupUnit, audioUnitBox)
            audioBusBox.output.refer(audioUnitBox.input)
        })
        primaryAudioOutputUnit.index.setValue(this.#audioUnitIndex)

        // connect
        const audioUnits: ReadonlyArray<AudioUnit> = [
            ...this.#project.instrumentUnits,
            ...this.#project.groupUnits
        ]
        audioUnits.forEach((audioUnit: AudioUnit) => {
            const {output} = audioUnit
            const audioBusBox = isDefined(output) ? busMap.get(output) : null
            if (isDefined(audioBusBox)) {
                const audioUnitBox = asDefined(audioUnitMap.get(audioUnit), "audio unit not found in map")
                audioUnitBox.output.refer(audioBusBox.input)
            }
        })
    }
}