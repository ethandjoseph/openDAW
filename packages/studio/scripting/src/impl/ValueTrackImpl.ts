import {AudioEffects, AudioUnit, Instruments, MIDIEffects, ValueRegion, ValueRegionProps, ValueTrack} from "../Api"
import {ValueRegionImpl} from "./ValueRegionImpl"

export class ValueTrackImpl implements ValueTrack {
    readonly target: { audioUnit: AudioUnit; parameter: string }
    readonly #regions: Array<ValueRegionImpl>

    enabled: boolean

    constructor(audioUnit: AudioUnit,
                target: MIDIEffects[keyof MIDIEffects] | AudioEffects[keyof AudioEffects] | Instruments[keyof Instruments],
                parameter: string) {
        this.target = {audioUnit, parameter}
        this.enabled = true
        this.#regions = []
    }

    addRegion(props?: ValueRegionProps): ValueRegion {
        const region = new ValueRegionImpl(this, props)
        this.#regions.push(region)
        return region
    }

    getRegions(): ReadonlyArray<ValueRegionImpl> {
        return this.#regions
    }
}
