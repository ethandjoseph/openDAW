import type {ppqn} from "@opendaw/lib-dsp"
import {PPQN} from "@opendaw/lib-dsp"
import {byte, unitValue} from "@opendaw/lib-std"

export {PPQN, ppqn}

export type NoteRegionParams = {
    position: ppqn
    duration: ppqn
    loopOffset?: ppqn
    loopDuration?: ppqn
    eventOffset?: ppqn
    mute?: boolean
    name?: string
    hue?: number
}

export type NoteEventParams = {
    position: ppqn
    duration?: ppqn
    pitch: byte
    velocity?: unitValue
}

export interface NoteRegion {
    createNoteEvent(params: NoteEventParams): void
}

export interface NoteTrack {
    createNoteRegion(params: NoteRegionParams): NoteRegion
}

export interface Instrument {}

export interface MIDIInstrument extends Instrument {
    createNoteTrack(): NoteTrack
}

export interface VaporisateurInstrument extends MIDIInstrument {}

export interface PlayfieldInstrument extends MIDIInstrument {/*TODO Add specific methods and props*/}

export interface NanoInstrument extends MIDIInstrument {/*TODO Add specific methods and props*/}

export interface SoundfontInstrument extends MIDIInstrument {/*TODO Add specific methods and props*/}

export interface TapeInstrument extends Instrument {/*TODO Add specific methods and props*/}

export interface MIDIOutputInstrument extends MIDIInstrument {/*TODO Add specific methods and props*/}

export interface ProjectFactory {
    createInstrument<KEY extends keyof InstrumentMap>(name: KEY): InstrumentMap[KEY]
    create(projectName?: string): void
}

export type InstrumentMap = {
    "Vaporisateur": VaporisateurInstrument
    "Playfield": PlayfieldInstrument
    "Nano": NanoInstrument
    "Tape": TapeInstrument
    "Soundfont": SoundfontInstrument
    "MIDIOutput": MIDIOutputInstrument
}

export interface Api {
    createProjectFactory(): ProjectFactory
    exitEditor(): void
}