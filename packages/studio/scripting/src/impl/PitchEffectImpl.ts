import {PitchEffect} from "../Api"
import {int, float} from "@opendaw/lib-std"

export class PitchEffectImpl implements PitchEffect {
    octaves: int
    semiTones: int
    cents: float

    constructor(props?: Partial<PitchEffect>) {
        this.octaves = props?.octaves ?? 0 as int
        this.semiTones = props?.semiTones ?? 0 as int
        this.cents = props?.cents ?? 0.0 as float
    }
}
