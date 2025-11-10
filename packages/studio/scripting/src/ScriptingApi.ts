import {ppqn} from "@opendaw/lib-dsp"

export type DurationUnit = "bars" | "beats" | "ms" | "s"
export type DurationString = `${number}${DurationUnit}`
export type Duration = ppqn | DurationString | "1/4" | "1/8" | "1/16" | "1/32"
export type TimePosition = ppqn | `${number}:${number}:${number}` | `${number}s`
export type VolumeString = `${number}dB` | `${number}%`
export type VolumeValue = number | VolumeString | "default"
export type PanString = `${number}%` | `-${number}%`
export type PanValue = number | PanString | "left" | "right" | "center"
export type ParamValue = number | string

export type SendParams = {
    target?: ReturnAudioUnit | OutputAudioUnit
    amount?: ParamValue
    pan?: PanValue
    mode?: "pre" | "post"
}

export interface Send {
    setTarget(target: ReturnAudioUnit | OutputAudioUnit): this
    setAmount(value: ParamValue): this
    setPan(value: PanValue): this
    setMode(mode: "pre" | "post"): this
}

export interface Sendable {
    addSend(params?: SendParams): Send
}

export interface AudioUnit {
    addAudioFx(name: string, params?: Record<string, ParamValue>): this
    setVolume(value: VolumeValue): this
    setPan(value: PanValue): this
    setMute(mute: boolean): this
    setSolo(solo: boolean): this
}

export interface InstrumentAudioUnit extends AudioUnit, Sendable {
    readonly kind: "instrument"
    setInstrument(name: string): this
    addMidiFx(name: string, params?: Record<string, ParamValue>): this
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