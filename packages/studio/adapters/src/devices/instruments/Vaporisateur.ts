import {StringMapping, ValueMapping} from "@opendaw/lib-std"

export const Vaporisateur = (() => {
    const MIN_CUTOFF = 20.0
    const MAX_CUTOFF = 20_000.0
    const FILTER_ORDER_VALUES = [1, 2, 3, 4]
    const FILTER_ORDER_STRINGS = ["12", "24", "36", "48"]
    return {
        MIN_CUTOFF,
        MAX_CUTOFF,
        CUTOFF_VALUE_MAPPING: ValueMapping.exponential(MIN_CUTOFF, MAX_CUTOFF),
        CUTOFF_STRING_MAPPING: StringMapping.numeric({unit: "Hz"}),
        FILTER_ORDER_VALUES,
        FILTER_ORDER_STRINGS,
        FILTER_ORDER_VALUE_MAPPING: ValueMapping.values(FILTER_ORDER_VALUES),
        FILTER_ORDER_STRING_MAPPING: StringMapping.values("db", FILTER_ORDER_VALUES, FILTER_ORDER_STRINGS)
    }
})()