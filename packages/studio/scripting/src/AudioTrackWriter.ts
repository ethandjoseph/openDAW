import {UUID} from "@opendaw/lib-std"
import {AudioFileBox, AudioRegionBox, AudioUnitBox, TrackBox} from "@opendaw/studio-boxes"
import {TrackType} from "@opendaw/studio-adapters"
import {BoxGraph} from "@opendaw/lib-box"
import {IndexRef} from "./IndexRef"
import {AudioTrackImpl} from "./impl/AudioTrackImpl"
import {AudioRegionImpl} from "./impl/AudioRegionImpl"

export namespace AudioTrackWriter {
    export const write = (boxGraph: BoxGraph,
                          audioUnitBox: AudioUnitBox,
                          audioTracks: ReadonlyArray<AudioTrackImpl>,
                          indexRef: IndexRef): void => {
        audioTracks.forEach(({enabled, regions}: AudioTrackImpl) => {
            const trackBox = TrackBox.create(boxGraph, UUID.generate(), box => {
                box.type.setValue(TrackType.Audio)
                box.enabled.setValue(enabled)
                box.index.setValue(indexRef.index++)
                box.target.refer(audioUnitBox)
                box.tracks.refer(audioUnitBox.tracks)
            })
            regions.forEach((region: AudioRegionImpl) => {
                const {
                    position, duration, loopDuration, loopOffset, hue, label, mute, sample
                } = region
                const fileBox = AudioFileBox.create(boxGraph, UUID.parse(sample.uuid), box => {
                    box.fileName.setValue(sample.name)
                    box.startInSeconds.setValue(0)
                    box.endInSeconds.setValue(sample.duration)
                })
                AudioRegionBox.create(boxGraph, UUID.generate(), box => {
                    box.position.setValue(position)
                    box.duration.setValue(duration)
                    box.loopDuration.setValue(loopDuration)
                    box.loopOffset.setValue(loopOffset)
                    box.hue.setValue(hue)
                    box.label.setValue(label)
                    box.mute.setValue(mute)
                    box.regions.refer(trackBox.regions)
                    box.file.refer(fileBox)
                })
            })
        })
    }
}