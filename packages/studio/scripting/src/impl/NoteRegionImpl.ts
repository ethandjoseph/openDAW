import {NoteRegion, NoteEvent, NoteTrack} from "../Api"
import {ppqn} from "@opendaw/lib-dsp"
import {int} from "@opendaw/lib-std"
import {NoteEventImpl} from "./NoteEventImpl"

export class NoteRegionImpl implements NoteRegion {
    readonly track: NoteTrack
    position: ppqn
    duration: ppqn
    mute: boolean
    label: string
    hue: int
    loopDuration: ppqn
    loopOffset: ppqn
    
    #events: NoteEventImpl[]

    constructor(track: NoteTrack, props?: Partial<NoteRegion>) {
        this.track = track
        this.position = props?.position ?? 0.0 as ppqn
        this.duration = props?.duration ?? 0.0 as ppqn
        this.mute = props?.mute ?? false
        this.label = props?.label ?? ""
        this.hue = props?.hue ?? 0 as int
        this.loopDuration = props?.loopDuration ?? 0.0 as ppqn
        this.loopOffset = props?.loopOffset ?? 0.0 as ppqn
        this.#events = []
    }

    addEvent(props?: Partial<NoteEvent>): NoteEvent {
        const event = new NoteEventImpl(props)
        this.#events.push(event)
        return event
    }

    getEvents(): ReadonlyArray<NoteEventImpl> {
        return this.#events
    }
}
