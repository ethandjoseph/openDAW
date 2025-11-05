import {StringMapping, ValueMapping} from "@opendaw/lib-std"

export const Vaporisateur = (() => {
    const MIN_CUTOFF = 20.0
    const MAX_CUTOFF = 20_000.0
    return {
        MIN_CUTOFF,
        MAX_CUTOFF,
        CUTOFF_VALUE_MAPPING: ValueMapping.exponential(MIN_CUTOFF, MAX_CUTOFF),
        CUTOFF_STRING_MAPPING: StringMapping.numeric({unit: "Hz"})
    }
})()