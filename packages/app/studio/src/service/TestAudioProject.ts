import {StudioService} from "@/service/StudioService"
import {
    AudioUnitFactory,
    AudioWarpingIO,
    InstrumentFactories,
    ProjectSkeleton,
    TrackType
} from "@opendaw/studio-adapters"
import {AudioPlayback, AudioUnitType, IconSymbol} from "@opendaw/studio-enums"
import {
    AudioFileBox,
    AudioRegionBox,
    AudioWarpingBox,
    CaptureAudioBox,
    TrackBox,
    ValueEventCollectionBox
} from "@opendaw/studio-boxes"
import {Arrays, Option, UUID} from "@opendaw/lib-std"
import {Project} from "@opendaw/studio-core"
import {PPQN, TimeBase} from "@opendaw/lib-dsp"

export const testAudioProject = (service: StudioService) => {
    const skeleton =
        ProjectSkeleton.empty({createDefaultUser: true, createOutputCompressor: false})
    const {boxGraph, mandatoryBoxes: {userInterfaceBoxes}} = skeleton
    boxGraph.beginTransaction()
    const audioUnitBox = AudioUnitFactory.create(skeleton,
        AudioUnitType.Instrument, Option.wrap(CaptureAudioBox.create(boxGraph, UUID.generate())))
    const tapeBox = InstrumentFactories.Tape
        .create(boxGraph, audioUnitBox.input, "Tape", IconSymbol.Play)
    const trackBox = TrackBox.create(boxGraph, UUID.generate(), box => {
        box.target.refer(tapeBox)
        box.type.setValue(TrackType.Audio)
        box.tracks.refer(audioUnitBox.tracks)
    })
    const durationInSeconds = 5.485708236694336
    const audioFileBox = AudioFileBox.create(boxGraph, UUID.parse("ae2360d9-3829-47d5-8c4d-4ba67c37451f"),
        box => box.endInSeconds.setValue(durationInSeconds))
    const valueEventCollectionBox = ValueEventCollectionBox.create(boxGraph, UUID.generate())
    const audioWarpingBox = AudioWarpingBox.create(boxGraph, UUID.generate(), box => {
        const n = 8
        AudioWarpingIO.writeTransientMarkers(box.transients, Arrays.create(index => ({
            seconds: index / (n - 1) * durationInSeconds,
            energy: 0.0
        }), n))
        AudioWarpingIO.writeWarpMarkers(box.wraps, [
            {
                time: 0, seconds: 0.0
            }, {
                time: PPQN.Bar * 4, seconds: durationInSeconds
            }])
    })
    const audioRegionBox = AudioRegionBox.create(boxGraph, UUID.generate(), box => {
        box.timeBase.setValue(TimeBase.Musical)
        box.playback.setValue(AudioPlayback.Pitch)
        box.duration.setValue(PPQN.Bar * 4)
        box.loopDuration.setValue(PPQN.Bar * 4)
        box.file.refer(audioFileBox)
        box.events.refer(valueEventCollectionBox.owners)
        box.regions.refer(trackBox.regions)
        box.warping.refer(audioWarpingBox)
    })

    userInterfaceBoxes[0].editingTimelineRegion.refer(audioRegionBox)

    boxGraph.endTransaction()
    service.projectProfileService.setProject(Project.skeleton(service, skeleton), "Test Project")
}