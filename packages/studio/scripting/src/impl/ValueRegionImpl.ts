import {ValueRegion, ValueEvent, ValueTrack} from "../Api"
import {ppqn} from "@opendaw/lib-dsp"
import {int} from "@opendaw/lib-std"
import {ValueEventImpl} from "./ValueEventImpl"

export class ValueRegionImpl implements ValueRegion {
    readonly track: ValueTrack
    position: ppqn
    duration: ppqn
    mute: boolean
    label: string
    hue: int
    loopDuration: ppqn
    loopOffset: ppqn
    
    #events: ValueEventImpl[]

    constructor(track: ValueTrack, props?: Partial<ValueRegion>) {
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

    addEvent(props?: Partial<ValueEvent>): ValueEvent {
        const event = new ValueEventImpl(props)
        this.#events.push(event)
        return event
    }

    getEvents(): ReadonlyArray<ValueEventImpl> {
        return this.#events
    }
}
