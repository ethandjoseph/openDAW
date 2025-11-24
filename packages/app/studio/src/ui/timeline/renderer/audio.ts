import {Peaks, PeaksPainter} from "@opendaw/lib-fusion"
import {TimelineRange} from "@opendaw/studio-core"
import {AudioFileBoxAdapter, AudioWarpingBoxAdapter} from "@opendaw/studio-adapters"
import {Iterables, Option} from "@opendaw/lib-std"
import {RegionBound} from "@/ui/timeline/renderer/env"
import {dbToGain, LoopableRegion} from "@opendaw/lib-dsp"

export const renderAudio = (context: CanvasRenderingContext2D,
                            range: TimelineRange,
                            file: AudioFileBoxAdapter,
                            warping: Option<AudioWarpingBoxAdapter>,
                            gain: number,
                            {top, bottom}: RegionBound,
                            contentColor: string,
                            {
                                rawStart,
                                resultStart,
                                resultEnd,
                                resultStartValue,
                                resultEndValue
                            }: LoopableRegion.LoopCycle) => {
    if (file.peaks.isEmpty()) {return}
    const peaks: Peaks = file.peaks.unwrap()
    const numFrames = peaks.numFrames
    const numberOfChannels = peaks.numChannels
    const ht = bottom - top
    const peaksHeight = Math.floor((ht - 4) / numberOfChannels)
    const scale = dbToGain(-gain)
    const segments: Array<{ x0: number, x1: number, u0: number, u1: number }> = []
    if (warping.nonEmpty()) {
        const {warpMarkers} = warping.unwrap()
        const firstMarker = warpMarkers.lowerEqual(Number.POSITIVE_INFINITY)
        const lastMarker = warpMarkers.greaterEqual(Number.NEGATIVE_INFINITY)
        if (firstMarker === null || lastMarker === null) {
            return
        }
        const durationInSeconds = firstMarker.seconds
        const offset = rawStart - lastMarker.position

        for (const [w0, w1] of Iterables.pairWise(warpMarkers.iterateFrom(range.unitMin - offset))) {
            if (w1 === null) {break} // TODO
            const segmentStart = offset + w0.position
            const segmentEnd = offset + w1.position
            if (segmentEnd <= resultStart || segmentStart >= resultEnd) {continue}
            if (segmentStart > range.unitMax) {break}
            const clippedStart = Math.max(segmentStart, resultStart)
            const clippedEnd = Math.min(segmentEnd, resultEnd)
            const t0 = (clippedStart - segmentStart) / (segmentEnd - segmentStart)
            const t1 = (clippedEnd - segmentStart) / (segmentEnd - segmentStart)
            const audioStart = w0.seconds + t0 * (w1.seconds - w0.seconds)
            const audioEnd = w0.seconds + t1 * (w1.seconds - w0.seconds)
            segments.push({
                x0: range.unitToX(clippedStart) * devicePixelRatio,
                x1: range.unitToX(clippedEnd) * devicePixelRatio,
                u0: (audioStart / durationInSeconds) * numFrames,
                u1: (audioEnd / durationInSeconds) * numFrames
            })
        }
    } else {
        segments.push({
            x0: range.unitToX(resultStart) * devicePixelRatio,
            x1: range.unitToX(resultEnd) * devicePixelRatio,
            u0: resultStartValue * numFrames,
            u1: resultEndValue * numFrames
        })
    }
    context.fillStyle = contentColor
    for (const {x0, x1, u0, u1} of segments) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            PeaksPainter.renderBlocks(context, peaks, channel, {
                u0, u1,
                v0: -scale, v1: +scale,
                x0, x1,
                y0: 3 + top + channel * peaksHeight,
                y1: 3 + top + (channel + 1) * peaksHeight
            })
        }
    }
}