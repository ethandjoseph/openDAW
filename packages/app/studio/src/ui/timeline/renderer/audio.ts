import {Peaks, PeaksPainter} from "@opendaw/lib-fusion"
import {TimelineRange} from "@opendaw/studio-core"
import {AudioFileBoxAdapter, AudioWarpingBoxAdapter} from "@opendaw/studio-adapters"
import {Option} from "@opendaw/lib-std"
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
                                rawEnd,
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
    const segments: Array<{ x0: number, x1: number, u0: number, u1: number, outside: boolean }> = []
    if (warping.nonEmpty()) {
        const {warpMarkers} = warping.unwrap()
        const markers = warpMarkers.asArray()
        if (markers.length < 2) {return}
        const first = markers[0]
        const second = markers[1]
        const secondLast = markers[markers.length - 2]
        const last = markers[markers.length - 1]
        const firstRate = (second.seconds - first.seconds) / (second.position - first.position)
        const lastRate = (last.seconds - secondLast.seconds) / (last.position - secondLast.position)
        const addSegment = (segmentStart: number, segmentEnd: number, audioStartSeconds: number, audioEndSeconds: number) => {
            if (segmentStart >= segmentEnd) {return}
            if (segmentStart > range.unitMax || segmentEnd < range.unitMin) {return}
            if (clip && (segmentEnd <= resultStart || segmentStart >= resultEnd)) {return}
            const clippedStart = clip ? Math.max(segmentStart, resultStart, range.unitMin) : Math.max(segmentStart, range.unitMin)
            const clippedEnd = clip ? Math.min(segmentEnd, resultEnd, range.unitMax) : Math.min(segmentEnd, range.unitMax)
            if (clippedStart >= clippedEnd) {return}
            const t0 = (clippedStart - segmentStart) / (segmentEnd - segmentStart)
            const t1 = (clippedEnd - segmentStart) / (segmentEnd - segmentStart)
            let audioStart = audioStartSeconds + t0 * (audioEndSeconds - audioStartSeconds) + waveformOffset
            let audioEnd = audioStartSeconds + t1 * (audioEndSeconds - audioStartSeconds) + waveformOffset
            let x0 = range.unitToX(clippedStart) * devicePixelRatio
            let x1 = range.unitToX(clippedEnd) * devicePixelRatio
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
            if (audioStart >= audioEnd) {return}
            segments.push({
                x0,
                x1,
                u0: (audioStart / durationInSeconds) * numFrames,
                u1: (audioEnd / durationInSeconds) * numFrames,
                outside: segmentStart < rawStart || segmentEnd > rawEnd
            })
        }
        const visibleLocalStart = (clip ? Math.max(range.unitMin, resultStart) : range.unitMin) - rawStart
        const visibleLocalEnd = (clip ? Math.min(range.unitMax, resultEnd) : range.unitMax) - rawStart
        // With positive offset, audio from file start appears BEFORE first.position
        // With negative offset, audio from file end appears AFTER last.position
        const extraNeededBefore = waveformOffset > 0 ? waveformOffset / firstRate : 0
        const extraNeededAfter = waveformOffset < 0 ? -waveformOffset / lastRate : 0
        const extrapolateStartLocal = Math.min(visibleLocalStart, first.position - extraNeededBefore)
        const extrapolateEndLocal = Math.max(visibleLocalEnd, last.position + extraNeededAfter)
        // Extrapolate before the first warp marker
        if (extrapolateStartLocal < first.position) {
            const audioStart = first.seconds + (extrapolateStartLocal - first.position) * firstRate
            addSegment(rawStart + extrapolateStartLocal, rawStart + first.position, audioStart, first.seconds)
        }
        // Interior warp segments
        for (let i = 0; i < markers.length - 1; i++) {
            const w0 = markers[i]
            const w1 = markers[i + 1]
            addSegment(rawStart + w0.position, rawStart + w1.position, w0.seconds, w1.seconds)
        }
        // Extrapolate after the last warp marker
        if (extrapolateEndLocal > last.position) {
            const audioEnd = last.seconds + (extrapolateEndLocal - last.position) * lastRate
            addSegment(rawStart + last.position, rawStart + extrapolateEndLocal, last.seconds, audioEnd)
        }
    } else {
        // TODO Does not paint waveforms outside the loop bounds
        const frameOffset = (waveformOffset / durationInSeconds) * numFrames
        let u0 = resultStartValue * numFrames + frameOffset
        let u1 = resultEndValue * numFrames + frameOffset
        let x0 = range.unitToX(resultStart) * devicePixelRatio
        let x1 = range.unitToX(resultEnd) * devicePixelRatio
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
            segments.push({x0, x1, u0, u1, outside: false})
        }
    }

    context.fillStyle = contentColor
    for (const {x0, x1, u0, u1, outside} of segments) {
        context.globalAlpha = outside && !clip ? 0.25 : 1.00
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