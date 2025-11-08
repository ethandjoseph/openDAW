export interface Instrument {}

export interface Vaporisateur extends Instrument {/*TODO Add specific methods and props*/}

export interface Playfield extends Instrument {/*TODO Add specific methods and props*/}

export interface Nano extends Instrument {/*TODO Add specific methods and props*/}

export interface Tape extends Instrument {/*TODO Add specific methods and props*/}

interface InstrumentMap extends MIDIPortEventMap {
    "Vaporisateur": Vaporisateur
    "Playfield": Playfield
    "Nano": Nano
    "Tape": Tape
}

export interface AudioUnit {}

export interface AudioUnitInstrument extends AudioUnit {
    createInstrument: <I extends keyof InstrumentMap>(instrument: I) => InstrumentMap[I]
}

export interface AudioUnitMap {
    "instrument": AudioUnitInstrument
}

export interface ScriptEditorApi {
    createAudioUnit: <K extends keyof AudioUnitMap>(type: K) => AudioUnitMap[K]
}