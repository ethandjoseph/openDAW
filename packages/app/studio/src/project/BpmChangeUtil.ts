import {Project} from "@opendaw/studio-core"
import {AnyRegionBoxAdapter, AudioRegionBoxAdapter} from "@opendaw/studio-adapters"
import {AudioPlayback} from "@opendaw/studio-enums"
import {PPQN} from "@opendaw/lib-dsp"
import {isNull, Iterables} from "@opendaw/lib-std"

export namespace BpmChangeUtil {
    // Since we do not have unsynch playback, we are going to change the region that has 'autofit' enabled.
    // This will cause resizing the regions to always play at absolute time (no adaption to tempo change).
    export const respectAutofit = (project: Project, newBpm: number, mark: boolean): void => {
        const {editing, timelineBox: {bpm: bpmField}, rootBoxAdapter} = project
        const autofitRegions: ReadonlyArray<ReadonlyArray<AudioRegionBoxAdapter>> = rootBoxAdapter.audioUnits.adapters()
            .flatMap(audioUnitBoxAdapter => audioUnitBoxAdapter.tracks.values()
                .map(trackBoxAdapter => trackBoxAdapter.regions.collection.asArray()
                    .filter((regionBoxAdapter: AnyRegionBoxAdapter): regionBoxAdapter is AudioRegionBoxAdapter =>
                        regionBoxAdapter.accept({
                            visitAudioRegionBoxAdapter: (region: AudioRegionBoxAdapter) =>
                                region.box.playback.getValue() === AudioPlayback.AudioFit
                        }) ?? false)))
        const oldBpm = bpmField.getValue()
        const scale = newBpm / oldBpm
        editing.modify(() => {
            autofitRegions.forEach(regions => {
                for (const [region, next] of Iterables.pairWise(regions)) {
                    let durationInSeconds = region.file.endInSeconds - region.file.startInSeconds
                    if (durationInSeconds === 0) {
                        console.warn("BpmChangeUtil.respectAutofit: durationInSeconds is 0. Try to access file.")
                        const {numberOfFrames, sampleRate} =
                            region.file.getOrCreateLoader().data
                                .unwrap("BpmChangeUtil.respectAutofit: durationInSeconds is 0 and audio is not loaded yet.")
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
}