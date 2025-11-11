import {ValueTrack, ValueRegion, AudioUnit, Instruments, AudioEffects, MIDIEffects} from "../Api"
import {ValueRegionImpl} from "./ValueRegionImpl"

export class ValueTrackImpl implements ValueTrack {
    readonly target: { audioUnit: AudioUnit; parameter: string }
    enabled: boolean
    
    #regions: ValueRegionImpl[]

    constructor(
        audioUnit: AudioUnit,
        targetEffect: MIDIEffects[keyof MIDIEffects] | AudioEffects[keyof AudioEffects] | Instruments[keyof Instruments],
        parameter: string
    ) {
        this.target = { audioUnit, parameter }
        this.enabled = true
        this.#regions = []
    }

    addRegion(props?: Partial<ValueRegion>): ValueRegion {
        const region = new ValueRegionImpl(this, props)
        this.#regions.push(region)
        return region
    }

    getRegions(): ReadonlyArray<ValueRegionImpl> {
        return this.#regions
    }
}
