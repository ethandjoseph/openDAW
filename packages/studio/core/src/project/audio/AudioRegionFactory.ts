import {ppqn, PPQN, TimeBase} from "@opendaw/lib-dsp"
import {ColorCodes, Sample, TrackType} from "@opendaw/studio-adapters"
import {panic, UUID} from "@opendaw/lib-std"
import {
    AudioFileBox,
    AudioRegionBox,
    AudioTimeStretchBox,
    TrackBox,
    ValueEventCollectionBox,
    WarpMarkerBox
} from "@opendaw/studio-boxes"
import {TransientPlayMode} from "@opendaw/studio-enums"
import {BoxGraph} from "@opendaw/lib-box"

export namespace AudioRegionFactory {
    export type TimeStretchedRegionProps = {
        boxGraph: BoxGraph,
        targetTrack: TrackBox,
        position: ppqn,
        audioFileBox: AudioFileBox,
        sample: Sample,
        transientPlayMode?: TransientPlayMode
        playbackRate?: number
    }

    export const createTimeStretchedRegion = (
        {
            boxGraph, targetTrack, position, audioFileBox, sample, playbackRate, transientPlayMode
        }: TimeStretchedRegionProps): AudioRegionBox => {
        if (targetTrack.type.getValue() !== TrackType.Audio) {
            return panic("Cannot create audio-region on non-audio track")
        }
        const {name, duration: durationInSeconds, bpm} = sample
        const durationInPPQN = Math.round(PPQN.secondsToPulses(durationInSeconds, bpm))
        const collectionBox = ValueEventCollectionBox.create(boxGraph, UUID.generate())
        const timeStretchBox = AudioTimeStretchBox.create(boxGraph, UUID.generate(), box => {
            box.transientPlayMode.setValue(transientPlayMode ?? TransientPlayMode.Pingpong)
            box.playbackRate.setValue(playbackRate ?? 1.0)
        })
        WarpMarkerBox.create(boxGraph, UUID.generate(), box => {
            box.owner.refer(timeStretchBox.warpMarkers)
            box.position.setValue(0)
            box.seconds.setValue(0)
        })
        WarpMarkerBox.create(boxGraph, UUID.generate(), box => {
            box.owner.refer(timeStretchBox.warpMarkers)
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
            box.playMode.refer(timeStretchBox)
        })
    }
}