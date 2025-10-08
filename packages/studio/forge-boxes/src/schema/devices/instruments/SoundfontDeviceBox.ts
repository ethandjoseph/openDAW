import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"
import {createInstrumentDevice} from "../builder"

export const SoundfontDeviceBox: BoxSchema<Pointers> = createInstrumentDevice("SoundfontDeviceBox", {})