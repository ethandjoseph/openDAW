import {Address} from "@opendaw/lib-box"
import {UUID} from "@opendaw/lib-std"

export namespace EngineAddresses {
    export const PEAKS = Address.compose(UUID.Lowest).append(0)
    export const SPECTRUM = Address.compose(UUID.Lowest).append(1)
}