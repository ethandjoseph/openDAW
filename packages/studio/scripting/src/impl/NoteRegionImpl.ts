import {NoteEvent, NoteRegion, NoteTrack} from "../Api"
import {ppqn} from "@opendaw/lib-dsp"
import {int} from "@opendaw/lib-std"
import {NoteEventImpl} from "./NoteEventImpl"
import {ColorCodes, TrackType} from "@opendaw/studio-adapters"

export class NoteRegionImpl implements NoteRegion {
    readonly track: NoteTrack
    readonly #events: NoteEventImpl[]

    position: ppqn
    duration: ppqn
    mute: boolean
    label: string
    hue: int
    loopDuration: ppqn
    loopOffset: ppqn

    constructor(track: NoteTrack, props?: Partial<NoteRegion>) {
        this.track = track
        this.position = props?.position ?? 0.0 as ppqn
        this.duration = props?.duration ?? 0.0 as ppqn
        this.loopDuration = props?.loopDuration ?? this.duration
        this.loopOffset = props?.loopOffset ?? 0.0 as ppqn
        this.mute = props?.mute ?? false
        this.label = props?.label ?? ""
        this.hue = props?.hue ?? ColorCodes.forTrackType(TrackType.Notes)
        this.#events = []
    }

    addEvent(props?: Partial<NoteEvent>): NoteEvent {
        const event = new NoteEventImpl(props)
        this.#events.push(event)
        return event
    }

    get events(): ReadonlyArray<NoteEventImpl> {return this.#events}
}
