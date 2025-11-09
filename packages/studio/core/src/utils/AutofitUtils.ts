import {AnyRegionBoxAdapter, AudioRegionBoxAdapter, TrackBoxAdapter} from "@opendaw/studio-adapters"
import {AudioPlayback} from "@opendaw/studio-enums"
import {PPQN} from "@opendaw/lib-dsp"
import {ArrayMultimap, isNull, Iterables, Nullable} from "@opendaw/lib-std"
import {Project} from "../project"

export namespace AutofitUtils {
    // Since we do not have an unsynchronized playback, we are going to change the region that has 'autofit' enabled.
    // This will cause resizing the regions to always play at absolute time (no adaption to tempo change).
    export const changeBpm = (project: Project, newBpm: number, mark: boolean): void => {
        const {editing, timelineBox: {bpm: bpmField}, rootBoxAdapter} = project
        const autofitRegions: ReadonlyArray<ReadonlyArray<AudioRegionBoxAdapter>> = rootBoxAdapter.audioUnits.adapters()
            .flatMap(audioUnitBoxAdapter => audioUnitBoxAdapter.tracks.values()
                .map(trackBoxAdapter => trackBoxAdapter.regions.collection.asArray()
                    .filter((regionBoxAdapter: AnyRegionBoxAdapter): regionBoxAdapter is AudioRegionBoxAdapter =>
                        regionBoxAdapter.accept({
                            visitAudioRegionBoxAdapter: (_region: AudioRegionBoxAdapter) => true

                        }) ?? false)))
        const oldBpm = bpmField.getValue()
        const scale = newBpm / oldBpm
        editing.modify(() => {
            autofitRegions.forEach(regions => {
                for (const [region, next] of Iterables.pairWise(regions)) {
                    // we cannot filter them upfront because the next region would be missing as a limit
                    if (region.box.playback.getValue() !== AudioPlayback.AudioFit) {continue}
                    let durationInSeconds = region.file.endInSeconds - region.file.startInSeconds
                    if (durationInSeconds === 0) {
                        console.warn("AutofitUtils.changeBpm: durationInSeconds is 0. Try to access file.")
                        const {numberOfFrames, sampleRate} =
                            region.file.getOrCreateLoader().data
                                .unwrap("AutofitUtils.changeBpm: durationInSeconds is 0 and audio is not loaded yet.")
                        durationInSeconds = numberOfFrames / sampleRate
                    }
                    const max = isNull(next) ? Number.POSITIVE_INFINITY : next.position
                    const durationInPulses = Math.min(max, PPQN.secondsToPulses(durationInSeconds, newBpm))
                    const oldDuration = region.box.duration.getValue()
                    const oldLoopOffset = region.box.loopOffset.getValue()
                    const oldLoopDuration = region.box.loopDuration.getValue()
                    const repeat = oldDuration / oldLoopDuration
                    region.box.duration.setValue(durationInPulses * repeat)
                    region.box.loopDuration.setValue(durationInPulses)
                    region.box.loopOffset.setValue(oldLoopOffset * scale)
                }
            })
            bpmField.setValue(newBpm)
        }, mark)
    }

    export const regionsToAutofit = (project: Project, regions: ReadonlyArray<AudioRegionBoxAdapter>) => {
        if (regions.length === 0) return
        const map = new ArrayMultimap<TrackBoxAdapter, AudioRegionBoxAdapter>()
        regions.forEach(region => map.add(region.trackBoxAdapter
            .unwrap("AutofitUtils.regionsToAutofit: Could not unwrap trackBoxAdapter"), region))
        const {editing, timelineBox: {bpm: bpmField}} = project
        const bpm = bpmField.getValue()
        editing.modify(() => map.forEach((trackBoxAdapter, regions) => {
            for (const region of regions) {
                const next: Nullable<AnyRegionBoxAdapter> =
                    trackBoxAdapter.regions.collection.greaterEqual(region.complete + 1)
                const max = isNull(next) ? Number.POSITIVE_INFINITY : next.position
                let durationInSeconds = region.file.endInSeconds - region.file.startInSeconds
                if (durationInSeconds === 0) {
                    console.warn("AutofitUtils.regionsToAutofit: durationInSeconds is 0. Try to access file.")
                    const {numberOfFrames, sampleRate} =
                        region.file.getOrCreateLoader().data
                            .unwrap("AutofitUtils.regionsToAutofit: durationInSeconds is 0 and audio is not loaded yet.")
                    durationInSeconds = numberOfFrames / sampleRate
                }
                const durationInPulses = Math.min(max, PPQN.secondsToPulses(durationInSeconds, bpm))
                const oldDuration = region.box.duration.getValue()
                const oldLoopOffset = region.box.loopOffset.getValue()
                const oldLoopDuration = region.box.loopDuration.getValue()
                const repeat = oldDuration / oldLoopDuration
                const scale = durationInPulses / oldLoopDuration
                region.box.playback.setValue(AudioPlayback.AudioFit)
                region.box.duration.setValue(durationInPulses * repeat)
                region.box.loopDuration.setValue(durationInPulses)
                region.box.loopOffset.setValue(oldLoopOffset * scale)
            }
        }))
    }
}