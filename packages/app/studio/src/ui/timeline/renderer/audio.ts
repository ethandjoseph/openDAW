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
                            waveformOffset: number,
                            gain: number,
                            {top, bottom}: RegionBound,
                            contentColor: string,
                            {
                                rawStart,
                                resultStart,
                                resultEnd,
                                resultStartValue,
                                resultEndValue
                            }: LoopableRegion.LoopCycle, clip: boolean = true) => {
    if (file.peaks.isEmpty()) {return}
    const peaks: Peaks = file.peaks.unwrap()
    const durationInSeconds = file.endInSeconds - file.startInSeconds
    const numFrames = peaks.numFrames
    const numberOfChannels = peaks.numChannels
    const ht = bottom - top
    const peaksHeight = Math.floor((ht - 4) / numberOfChannels)
    const scale = dbToGain(-gain)
    const segments: Array<{ x0: number, x1: number, u0: number, u1: number }> = []
    if (warping.nonEmpty()) {
        const {warpMarkers} = warping.unwrap()
        for (const [w0, w1] of Iterables.pairWise(warpMarkers.iterateFrom(range.unitMin - rawStart))) {
            if (w1 === null) {break}
            const segmentStart = rawStart + w0.position
            const segmentEnd = rawStart + w1.position
            if (segmentEnd <= resultStart || segmentStart >= resultEnd) {continue}
            if (segmentStart > range.unitMax) {break}
            const clippedStart = clip ? Math.max(segmentStart, resultStart) : segmentStart
            const clippedEnd = clip ? Math.min(segmentEnd, resultEnd) : segmentEnd
            const t0 = (clippedStart - segmentStart) / (segmentEnd - segmentStart)
            const t1 = (clippedEnd - segmentStart) / (segmentEnd - segmentStart)
            let audioStart = w0.seconds + t0 * (w1.seconds - w0.seconds) + waveformOffset
            let audioEnd = w0.seconds + t1 * (w1.seconds - w0.seconds) + waveformOffset
            let x0 = range.unitToX(clippedStart) * devicePixelRatio
            let x1 = range.unitToX(clippedEnd) * devicePixelRatio
            // Clamp to valid file bounds, adjusting pixel range proportionally
            if (audioStart < 0.0) {
                const ratio = -audioStart / (audioEnd - audioStart)
                x0 = x0 + ratio * (x1 - x0)
                audioStart = 0.0
            }
            if (audioEnd > durationInSeconds) {
                const ratio = (audioEnd - durationInSeconds) / (audioEnd - audioStart)
                x1 = x1 - ratio * (x1 - x0)
                audioEnd = durationInSeconds
            }
            if (audioStart >= audioEnd) {continue}
            segments.push({
                x0,
                x1,
                u0: (audioStart / durationInSeconds) * numFrames,
                u1: (audioEnd / durationInSeconds) * numFrames
            })
        }
    } else {
        const frameOffset = (waveformOffset / durationInSeconds) * numFrames
        let u0 = resultStartValue * numFrames + frameOffset
        let u1 = resultEndValue * numFrames + frameOffset
        let x0 = range.unitToX(resultStart) * devicePixelRatio
        let x1 = range.unitToX(resultEnd) * devicePixelRatio
        // Clamp to valid file bounds
        if (u0 < 0) {
            const ratio = -u0 / (u1 - u0)
            x0 = x0 + ratio * (x1 - x0)
            u0 = 0
        }
        if (u1 > numFrames) {
            const ratio = (u1 - numFrames) / (u1 - u0)
            x1 = x1 - ratio * (x1 - x0)
            u1 = numFrames
        }
        if (u0 < u1) {
            segments.push({x0, x1, u0, u1})
        }
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