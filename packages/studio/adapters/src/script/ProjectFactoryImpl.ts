import {assert, InaccessibleProperty, Option, Strings, UUID} from "@opendaw/lib-std"
import {BoxGraph} from "@opendaw/lib-box"
import {AudioUnitType} from "@opendaw/studio-enums"
import {CaptureAudioBox, CaptureMidiBox} from "@opendaw/studio-boxes"
import {
    AudioUnitFactory,
    CaptureBox,
    InstrumentBox,
    InstrumentFactories,
    InstrumentFactory,
    InstrumentMap,
    InstrumentOptions,
    InstrumentProduct,
    ProjectFactory,
    ProjectQueries,
    ProjectSkeleton,
    TrackType
} from "@opendaw/studio-adapters"
import {ApiEnvironment} from "./ApiImpl"
import {MIDIInstrumentImpl} from "./MIDIInstrumentImpl"

export class ProjectFactoryImpl implements ProjectFactory {
    readonly #env: ApiEnvironment
    readonly #skeleton: ProjectSkeleton

    constructor(env: ApiEnvironment, skeleton: ProjectSkeleton) {
        this.#env = env
        this.#skeleton = skeleton
    }

    createInstrument<I extends InstrumentFactories.Keys>(instrument: I): InstrumentMap[I] {
        const factory: InstrumentFactory<any, any> = InstrumentFactories.Named[instrument]
        this.#skeleton.boxGraph.beginTransaction()
        const {instrumentBox, audioUnitBox} = this.#createInstrument(factory)
        this.#skeleton.boxGraph.endTransaction()
        return new MIDIInstrumentImpl(this.#skeleton, instrumentBox, audioUnitBox) as InstrumentMap[I]
    }

    create(projectName?: string): void {
        this.#env.buildProject(this.#skeleton, projectName)
    }

    #createInstrument<A, INST extends InstrumentBox>(
        {create, defaultIcon, defaultName, trackType}: InstrumentFactory<A, INST>,
        options: InstrumentOptions<A> = {} as any): InstrumentProduct<INST> {
        const {name, icon, index} = options
        const {boxGraph, mandatoryBoxes: {rootBox}} = this.#skeleton
        assert(rootBox.isAttached(), "rootBox not attached")
        const existingNames = ProjectQueries.existingInstrumentNames(rootBox)
        const audioUnitBox = AudioUnitFactory.create(this.#skeleton,
            AudioUnitType.Instrument, this.#trackTypeToCapture(boxGraph, trackType), index)
        const uniqueName = Strings.getUniqueName(existingNames, name ?? defaultName)
        const iconSymbol = icon ?? defaultIcon
        const instrumentBox = create(boxGraph, audioUnitBox.input, uniqueName, iconSymbol, options.attachment)
        return {audioUnitBox, instrumentBox, trackBox: InaccessibleProperty("No trackBox")}
    }

    #trackTypeToCapture(boxGraph: BoxGraph, trackType: TrackType): Option<CaptureBox> {
        switch (trackType) {
            case TrackType.Audio:
                return Option.wrap(CaptureAudioBox.create(boxGraph, UUID.generate()))
            case TrackType.Notes:
                return Option.wrap(CaptureMidiBox.create(boxGraph, UUID.generate()))
            default:
                return Option.None
        }
    }
}