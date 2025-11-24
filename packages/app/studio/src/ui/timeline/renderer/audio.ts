import {RegionBound} from "@/ui/timeline/renderer/env.ts"
import {dbToGain, LoopableRegion} from "@opendaw/lib-dsp"
import {Peaks, PeaksPainter} from "@opendaw/lib-fusion"
import {AudioFileBoxAdapter, AudioWarpingBoxAdapter} from "@opendaw/studio-adapters"
import {TimelineRange} from "@opendaw/studio-core"
import {Option} from "@opendaw/lib-std"

export const renderAudio = (context: CanvasRenderingContext2D,
                            range: TimelineRange,
                            file: AudioFileBoxAdapter,
                            warping: Option<AudioWarpingBoxAdapter>,
                            gain: number,
                            {top, bottom}: RegionBound,
                            contentColor: string,
                            {
                                resultStart,
                                resultEnd,
                                resultStartValue,
                                resultEndValue
                            }: LoopableRegion.LoopCycle) => {
    if (file.peaks.nonEmpty()) {

        if (warping.nonEmpty()) {
            const {warps} = warping.unwrap()
        }

        const x0 = range.unitToX(resultStart) * devicePixelRatio
        const x1 = range.unitToX(resultEnd) * devicePixelRatio
        const ht = bottom - top
        context.fillStyle = contentColor
        const peaks: Peaks = file.peaks.unwrap()
        // TODO Take unsynced region into account
        const numFrames = peaks.numFrames
        const numberOfChannels = peaks.numChannels
        const peaksHeight = Math.floor((ht - 4) / numberOfChannels)
        const scale = dbToGain(-gain)
        for (let channel = 0; channel < numberOfChannels; channel++) {
            PeaksPainter.renderBlocks(context, peaks, channel, {
                u0: resultStartValue * numFrames,
                u1: resultEndValue * numFrames,
                v0: -scale,
                v1: +scale,
                x0: x0,
                x1: x1,
                y0: 3 + top + channel * peaksHeight,
                y1: 3 + top + (channel + 1) * peaksHeight
            })
        }
    }
}