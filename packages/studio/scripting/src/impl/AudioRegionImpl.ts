import {AudioRegion, AudioTrack} from "../Api"
import {PPQN, ppqn} from "@opendaw/lib-dsp"
import {int, UUID} from "@opendaw/lib-std"
import {ColorCodes, TrackType} from "@opendaw/studio-adapters"

export class AudioRegionImpl implements AudioRegion {
    readonly track: AudioTrack

    uuid: UUID.Bytes
    position: ppqn
    duration: ppqn
    mute: boolean
    label: string
    hue: int
    loopDuration: ppqn
    loopOffset: ppqn

    constructor(track: AudioTrack, uuid: UUID.Bytes, props?: AudioRegion) {
        this.track = track
        this.uuid = uuid
        this.position = props?.position ?? 0.0
        this.duration = props?.duration ?? PPQN.Bar
        this.loopDuration = props?.loopDuration ?? this.duration
        this.loopOffset = props?.loopOffset ?? 0.0
        this.mute = props?.mute ?? false
        this.label = props?.label ?? ""
        this.hue = props?.hue ?? ColorCodes.forTrackType(TrackType.Audio)
    }
}
