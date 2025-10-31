import {IconSymbol, TrackType} from "@opendaw/studio-adapters"
import {BoxGraph, Field} from "@opendaw/lib-box"
import {BoxIO} from "@opendaw/studio-boxes"
import {InstrumentBox} from "./InstrumentBox"
import {Pointers} from "@opendaw/studio-enums"

export interface InstrumentFactory<A = any, INST extends InstrumentBox = InstrumentBox> {
    defaultName: string
    defaultIcon: IconSymbol
    description: string
    trackType: TrackType
    create: (boxGraph: BoxGraph<BoxIO.TypeMap>,
             host: Field<Pointers.InstrumentHost | Pointers.AudioOutput>,
             name: string,
             icon: IconSymbol,
             attachment?: A) => INST
}