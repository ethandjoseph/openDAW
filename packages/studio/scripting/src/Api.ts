import {Chord, Interpolation, PPQN, ppqn} from "@opendaw/lib-dsp"
import {bipolar, float, int, unitValue} from "@opendaw/lib-std"

export {PPQN, Chord}

export type PercentString = `${number}%`
export type Percent = PercentString | number
export type DurationUnit = "bars" | "beats" | "ms" | "s"
export type DurationString = `${number}${DurationUnit}`
export type Duration = ppqn | DurationString | "1/4" | "1/8" | "1/16" | "1/32"
export type VolumeString = `${number}dB` | PercentString
export type VolumeValue = number | VolumeString | "default"
export type PanValue = number | PercentString | "left" | "right" | "center"

export type Send = {
    amount: VolumeValue
    pan: PanValue
    mode: "pre" | "post"
}

export interface Sendable {
    addSend(props?: Partial<Send>): Send
}

export type AnyDevice =
    | MIDIEffects[keyof MIDIEffects]
    | AudioEffects[keyof AudioEffects]
    | Instruments[keyof Instruments]

export interface Effect {
    enabled: boolean
    label: string
}

export interface AudioEffect extends Effect {
    readonly key: keyof AudioEffects
}

export interface DelayEffect extends AudioEffect {
    delay: number
    feedback: number
    cross: number
    filter: number
    wet: number
    dry: number
}

export interface AudioEffects {
    "delay": DelayEffect
}

export interface MIDIEffect extends Effect {
    readonly key: keyof MIDIEffects
}

export interface PitchEffect extends MIDIEffect {
    key: keyof MIDIEffects
    octaves: int
    semiTones: int
    cents: float
}

export interface MIDIEffects {
    "pitch": PitchEffect
}

export interface AudioUnit {
    volume: number
    panning: bipolar
    mute: boolean
    solo: boolean
    addAudioEffect<T extends keyof AudioEffects>(type: T, props?: Partial<AudioEffects[T]>): AudioEffects[T]
    addMIDIEffect<T extends keyof MIDIEffects>(type: T, props?: Partial<MIDIEffects[T]>): MIDIEffects[T]
    addNoteTrack(props?: Partial<NoteTrack>): NoteTrack
    addValueTrack<DEVICE extends AnyDevice, PARAMETER extends keyof DEVICE>(
        device: DEVICE, parameter: PARAMETER, props?: Partial<ValueTrack>): ValueTrack
}

export interface InstrumentAudioUnit extends AudioUnit, Sendable {
    readonly kind: "instrument"
    readonly instrument: Instrument
    setInstrument(name: keyof Instruments): Instrument
}

export interface ReturnAudioUnit extends AudioUnit, Sendable {
    readonly kind: "return"
}

export interface GroupAudioUnit extends AudioUnit, Sendable {
    readonly kind: "group"
}

export interface OutputAudioUnit extends AudioUnit {
    readonly kind: "output"
}

export interface Track {
    readonly audioUnit: AudioUnit

    enabled: boolean
}

export interface Region {
    position: ppqn
    duration: ppqn
    mute: boolean
    label: string
    hue: int
}

export interface LoopableRegion extends Region {
    loopDuration: ppqn
    loopOffset: ppqn
}

export interface NoteEvent {
    position: ppqn
    duration: ppqn
    pitch: number
    cents: number
    velocity: number
}

export interface NoteRegion extends LoopableRegion {
    readonly track: NoteTrack
    addEvent(props?: Partial<NoteEvent>): NoteEvent
}

export type NoteRegionProps = Partial<NoteRegion & { mirror: NoteRegion }>

export interface NoteTrack extends Track {
    addRegion(props?: NoteRegionProps): NoteRegion
}

export interface ValueEvent {
    position: ppqn
    value: unitValue
    index: int
    interpolation: Interpolation
}

export interface ValueRegion extends LoopableRegion {
    readonly track: ValueTrack
    addEvent(props?: Partial<ValueEvent>): ValueEvent
}

export type ValueRegionProps = Partial<ValueRegion & { mirror: ValueRegion }>

export interface ValueTrack extends Track {
    addRegion(props?: ValueRegionProps): ValueRegion
}

export interface Instrument {
    readonly audioUnit: InstrumentAudioUnit
}

export interface MIDIInstrument extends Instrument {}

export interface Vaporisateur extends MIDIInstrument {}

export interface Playfield extends MIDIInstrument {}

export interface Nano extends MIDIInstrument {}

export interface Soundfont extends MIDIInstrument {}

export interface MIDIOutput extends MIDIInstrument {}

export type Instruments = {
    "Vaporisateur": Vaporisateur
    "Playfield": Playfield
    "Nano": Nano
    "Soundfont": Soundfont
    "MIDIOutput": MIDIOutput
}

export interface Project {
    readonly output: OutputAudioUnit

    name: string
    tempo: number

    addInstrumentUnit<KEY extends keyof Instruments>(name: KEY, props?: Partial<Instruments[KEY]>): InstrumentAudioUnit
    addReturnUnit(): ReturnAudioUnit
    addGroupUnit(): GroupAudioUnit

    openInStudio(): void
}

export interface Api {
    newProject(name?: string): Project
    getProject(): Promise<Project>
}

declare const openDAW: Api