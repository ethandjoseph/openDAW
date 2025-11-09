import {InstrumentFactories} from "@opendaw/studio-adapters"

export interface Instrument {}

export interface Vaporisateur extends Instrument {/*TODO Add specific methods and props*/}

export interface Playfield extends Instrument {/*TODO Add specific methods and props*/}

export interface Nano extends Instrument {/*TODO Add specific methods and props*/}

export interface Soundfont extends Instrument {/*TODO Add specific methods and props*/}

export interface Tape extends Instrument {/*TODO Add specific methods and props*/}

export interface MIDIOutput extends Instrument {/*TODO Add specific methods and props*/}

export type InstrumentMap = {
    "Vaporisateur": Vaporisateur
    "Playfield": Playfield
    "Nano": Nano
    "Tape": Tape
    "Soundfont": Soundfont
    "MIDIOutput": MIDIOutput
}

export interface Api {
    createInstrument<I extends InstrumentFactories.Keys>(instrument: I): InstrumentMap[I]
    create(): void
}