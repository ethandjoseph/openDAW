import {ValueMapping} from "@opendaw/lib-std"

export const Vaporisateur = (() => {
    const MIN_CUTOFF = 20.0
    const MAX_CUTOFF = 20_000.0
    return {
        MIN_CUTOFF,
        MAX_CUTOFF,
        CUTOFF_RANGE: ValueMapping.exponential(MIN_CUTOFF, MAX_CUTOFF)
    }
})()