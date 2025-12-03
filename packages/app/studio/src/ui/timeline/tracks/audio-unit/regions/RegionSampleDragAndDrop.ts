import {UUID} from "@opendaw/lib-std"
import {PPQN, TimeBase} from "@opendaw/lib-dsp"
import {AudioRegionBox, AudioTimeStretchBox, ValueEventCollectionBox, WarpMarkerBox} from "@opendaw/studio-boxes"
import {ColorCodes} from "@opendaw/studio-adapters"
import {RegionCaptureTarget} from "@/ui/timeline/tracks/audio-unit/regions/RegionCapturing.ts"
import {ElementCapturing} from "@/ui/canvas/capturing.ts"
import {RegionClipResolver} from "@opendaw/studio-core"
import {CreateParameters, TimelineDragAndDrop} from "@/ui/timeline/tracks/audio-unit/TimelineDragAndDrop"
import {Snapping} from "@/ui/timeline/Snapping"
import {StudioService} from "@/service/StudioService"
import {TransientPlayMode} from "@opendaw/studio-enums"

export class RegionSampleDragAndDrop extends TimelineDragAndDrop<RegionCaptureTarget> {
    readonly #snapping: Snapping

    constructor(service: StudioService, capturing: ElementCapturing<RegionCaptureTarget>, snapping: Snapping) {
        super(service, capturing)

        this.#snapping = snapping
    }

    handleSample({
                     event, trackBoxAdapter, audioFileBox, sample: {name, duration: durationInSeconds, bpm}
                 }: CreateParameters): void {
        const pointerX = event.clientX - this.capturing.element.getBoundingClientRect().left
        const pointerPulse = Math.max(this.#snapping.xToUnitFloor(pointerX), 0)
        const duration = Math.round(PPQN.secondsToPulses(durationInSeconds, bpm))
        const solver = RegionClipResolver.fromRange(trackBoxAdapter, pointerPulse, pointerPulse + duration)
        const boxGraph = this.project.boxGraph
        const collectionBox = ValueEventCollectionBox.create(boxGraph, UUID.generate())
        const timeStretchBox = AudioTimeStretchBox.create(boxGraph, UUID.generate(), box => {
            box.transientPlayMode.setValue(TransientPlayMode.Pingpong)
            box.playbackRate.setValue(1.0)
        })
        WarpMarkerBox.create(boxGraph, UUID.generate(), box => {
            box.owner.refer(timeStretchBox.warpMarkers)
            box.position.setValue(0)
            box.seconds.setValue(0)
        })
        WarpMarkerBox.create(boxGraph, UUID.generate(), box => {
            box.owner.refer(timeStretchBox.warpMarkers)
            box.position.setValue(duration)
            box.seconds.setValue(durationInSeconds)
        })
        AudioRegionBox.create(boxGraph, UUID.generate(), box => {
            box.position.setValue(pointerPulse)
            box.duration.setValue(duration)
            box.loopDuration.setValue(duration)
            box.regions.refer(trackBoxAdapter.box.regions)
            box.hue.setValue(ColorCodes.forTrackType(trackBoxAdapter.type))
            box.label.setValue(name)
            box.file.refer(audioFileBox)
            box.events.refer(collectionBox.owners)
            box.timeBase.setValue(TimeBase.Musical)
            box.playMode.refer(timeStretchBox)
        })
        solver()
    }
}