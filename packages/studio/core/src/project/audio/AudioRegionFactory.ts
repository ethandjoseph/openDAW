import {ppqn, PPQN, TimeBase} from "@opendaw/lib-dsp"
import {ColorCodes, Sample, TrackType} from "@opendaw/studio-adapters"
import {panic, UUID} from "@opendaw/lib-std"
import {
    AudioFileBox,
    AudioPitchBox,
    AudioRegionBox,
    AudioTimeStretchBox,
    TrackBox,
    ValueEventCollectionBox,
    WarpMarkerBox
} from "@opendaw/studio-boxes"
import {TransientPlayMode} from "@opendaw/studio-enums"
import {BoxGraph} from "@opendaw/lib-box"

export namespace AudioRegionFactory {
    type RegionProps = {
        boxGraph: BoxGraph,
        targetTrack: TrackBox,
        position: ppqn,
        audioFileBox: AudioFileBox,
        sample: Sample
    }

    export type TimeStretchedRegionProps = {
        transientPlayMode?: TransientPlayMode
        playbackRate?: number
    } & RegionProps

    export type PitchStretchedRegionProps = { /* Has no additional properties yet */ } & RegionProps

    export type NoWarpRegionProps = { /* Has no additional properties yet */ } & RegionProps

    export const createTimeStretchedRegion = (props: TimeStretchedRegionProps): AudioRegionBox => {
        const {boxGraph, playbackRate, transientPlayMode} = props
        return createRegionWithWarpMarkers(AudioTimeStretchBox.create(boxGraph, UUID.generate(), box => {
            box.transientPlayMode.setValue(transientPlayMode ?? TransientPlayMode.Pingpong)
            box.playbackRate.setValue(playbackRate ?? 1.0)
        }), props)
    }

    export const createPitchStretchedRegion = (props: PitchStretchedRegionProps): AudioRegionBox => {
        return createRegionWithWarpMarkers(AudioPitchBox.create(props.boxGraph, UUID.generate()), props)
    }

    export const createNotStretchedRegion = (props: NoWarpRegionProps): AudioRegionBox => {
        const {boxGraph, targetTrack, position, audioFileBox, sample: {name, duration: durationInSeconds}} = props
        const collectionBox = ValueEventCollectionBox.create(boxGraph, UUID.generate())
        return AudioRegionBox.create(boxGraph, UUID.generate(), box => {
            box.position.setValue(position)
            box.duration.setValue(durationInSeconds)
            box.loopDuration.setValue(durationInSeconds)
            box.regions.refer(targetTrack.regions)
            box.hue.setValue(ColorCodes.forTrackType(targetTrack.type.getValue()))
            box.label.setValue(name)
            box.file.refer(audioFileBox)
            box.events.refer(collectionBox.owners)
            box.timeBase.setValue(TimeBase.Seconds)
        })
    }

    const createRegionWithWarpMarkers = (playMode: AudioPitchBox | AudioTimeStretchBox,
                                         props: TimeStretchedRegionProps | PitchStretchedRegionProps) => {
        const {boxGraph, targetTrack, position, audioFileBox, sample} = props
        if (targetTrack.type.getValue() !== TrackType.Audio) {
            return panic("Cannot create audio-region on non-audio track")
        }
        const collectionBox = ValueEventCollectionBox.create(boxGraph, UUID.generate())
        const {name, duration: durationInSeconds, bpm} = sample
        const durationInPPQN = Math.round(PPQN.secondsToPulses(durationInSeconds, bpm))
        WarpMarkerBox.create(boxGraph, UUID.generate(), box => {
            box.owner.refer(playMode.warpMarkers)
            box.position.setValue(0)
            box.seconds.setValue(0)
        })
        WarpMarkerBox.create(boxGraph, UUID.generate(), box => {
            box.owner.refer(playMode.warpMarkers)
            box.position.setValue(durationInPPQN)
            box.seconds.setValue(durationInSeconds)
        })
        return AudioRegionBox.create(boxGraph, UUID.generate(), box => {
            box.position.setValue(position)
            box.duration.setValue(durationInPPQN)
            box.loopDuration.setValue(durationInPPQN)
            box.regions.refer(targetTrack.regions)
            box.hue.setValue(ColorCodes.forTrackType(targetTrack.type.getValue()))
            box.label.setValue(name)
            box.file.refer(audioFileBox)
            box.events.refer(collectionBox.owners)
            box.timeBase.setValue(TimeBase.Musical)
            box.playMode.refer(playMode)
        })
    }
}