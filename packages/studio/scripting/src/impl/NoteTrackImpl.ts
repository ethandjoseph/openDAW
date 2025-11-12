import {InstrumentAudioUnit, NoteRegion, NoteRegionProps, NoteTrack} from "../Api"
import {NoteRegionImpl} from "./NoteRegionImpl"

export class NoteTrackImpl implements NoteTrack {
    readonly audioUnit: InstrumentAudioUnit
    readonly #regions: NoteRegionImpl[]

    enabled: boolean

    constructor(audioUnit: InstrumentAudioUnit, props?: Partial<NoteTrack>) {
        this.audioUnit = audioUnit
        this.#regions = []

        this.enabled = props?.enabled ?? true
    }

    addRegion(props?: NoteRegionProps): NoteRegion {
        const region = new NoteRegionImpl(this, props)
        this.#regions.push(region)
        return region
    }

    get regions(): ReadonlyArray<NoteRegionImpl> {
        return this.#regions
    }
}
