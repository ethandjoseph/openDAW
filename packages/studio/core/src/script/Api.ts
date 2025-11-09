import {InstrumentFactories} from "@opendaw/studio-adapters"
import {byte, unitValue} from "@opendaw/lib-std"

export interface NoteRegion {
    createNoteEvent(pitch: byte, velocity: unitValue): void
}

export interface NoteTrack {
    createNoteRegion(): NoteRegion
}

export interface Instrument {}

export interface MIDIInstrument extends Instrument {
    createNoteTrack(): NoteTrack
}

export interface Vaporisateur extends MIDIInstrument {}

export interface Playfield extends MIDIInstrument {/*TODO Add specific methods and props*/}

export interface Nano extends MIDIInstrument {/*TODO Add specific methods and props*/}

export interface Soundfont extends MIDIInstrument {/*TODO Add specific methods and props*/}

export interface Tape extends Instrument {/*TODO Add specific methods and props*/}

export interface MIDIOutput extends MIDIInstrument {/*TODO Add specific methods and props*/}

export interface ProjectFactory {
    createInstrument<I extends InstrumentFactories.Keys>(instrument: I): InstrumentMap[I]
    render(projectName?: string): void
}

export type InstrumentMap = {
    "Vaporisateur": Vaporisateur
    "Playfield": Playfield
    "Nano": Nano
    "Tape": Tape
    "Soundfont": Soundfont
    "MIDIOutput": MIDIOutput
}

export interface Api {
    createProjectFactory(): ProjectFactory
}