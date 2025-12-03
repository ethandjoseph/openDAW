import {Peaks, PeaksPainter} from "@opendaw/lib-fusion"
import {TimelineRange} from "@opendaw/studio-core"
import {AudioFileBoxAdapter, AudioWarpingBoxAdapter} from "@opendaw/studio-adapters"
import {Option} from "@opendaw/lib-std"
import {RegionBound} from "@/ui/timeline/renderer/env"
import {dbToGain, LoopableRegion} from "@opendaw/lib-dsp"

type Segment = { x0: number, x1: number, u0: number, u1: number, outside: boolean }
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
    const segments: Array<Segment> = []
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
        const pushSegment = (posStart: number, posEnd: number, audioStart: number, audioEnd: number, outside: boolean) => {
            if (posStart >= posEnd) {return}
            if (posStart > range.unitMax || posEnd < range.unitMin) {return}
            const clippedStart = Math.max(posStart, range.unitMin)
            const clippedEnd = Math.min(posEnd, range.unitMax)
            if (clippedStart >= clippedEnd) {return}
            const t0 = (clippedStart - posStart) / (posEnd - posStart)
            const t1 = (clippedEnd - posStart) / (posEnd - posStart)
            let aStart = audioStart + t0 * (audioEnd - audioStart) + waveformOffset
            let aEnd = audioStart + t1 * (audioEnd - audioStart) + waveformOffset
            let x0 = range.unitToX(clippedStart) * devicePixelRatio
            let x1 = range.unitToX(clippedEnd) * devicePixelRatio
            if (aStart < 0.0) {
                const ratio = -aStart / (aEnd - aStart)
                x0 = x0 + ratio * (x1 - x0)
                aStart = 0.0
            }
            if (aEnd > durationInSeconds) {
                const ratio = (aEnd - durationInSeconds) / (aEnd - aStart)
                x1 = x1 - ratio * (x1 - x0)
                aEnd = durationInSeconds
            }
            if (aStart >= aEnd) {return}
            segments.push({
                x0,
                x1,
                u0: (aStart / durationInSeconds) * numFrames,
                u1: (aEnd / durationInSeconds) * numFrames,
                outside
            })
        }
        const addSegment = (segmentStart: number, segmentEnd: number, audioStartSeconds: number, audioEndSeconds: number) => {
            if (segmentStart >= segmentEnd) {return}
            if (clip) {
                if (segmentEnd <= resultStart || segmentStart >= resultEnd) {return}
                const clippedStart = Math.max(segmentStart, resultStart)
                const clippedEnd = Math.min(segmentEnd, resultEnd)
                const t0 = (clippedStart - segmentStart) / (segmentEnd - segmentStart)
                const t1 = (clippedEnd - segmentStart) / (segmentEnd - segmentStart)
                const aStart = audioStartSeconds + t0 * (audioEndSeconds - audioStartSeconds)
                const aEnd = audioStartSeconds + t1 * (audioEndSeconds - audioStartSeconds)
                pushSegment(clippedStart, clippedEnd, aStart, aEnd, false)
            } else {
                const rate = (audioEndSeconds - audioStartSeconds) / (segmentEnd - segmentStart)
                // Before audible
                if (segmentStart < resultStart) {
                    const endPos = Math.min(segmentEnd, resultStart)
                    const aEnd = audioStartSeconds + (endPos - segmentStart) * rate
                    pushSegment(segmentStart, endPos, audioStartSeconds, aEnd, true)
                }
                // Audible
                if (segmentEnd > resultStart && segmentStart < resultEnd) {
                    const startPos = Math.max(segmentStart, resultStart)
                    const endPos = Math.min(segmentEnd, resultEnd)
                    const aStart = audioStartSeconds + (startPos - segmentStart) * rate
                    const aEnd = audioStartSeconds + (endPos - segmentStart) * rate
                    pushSegment(startPos, endPos, aStart, aEnd, false)
                }
                // After audible
                if (segmentEnd > resultEnd) {
                    const startPos = Math.max(segmentStart, resultEnd)
                    const aStart = audioStartSeconds + (startPos - segmentStart) * rate
                    pushSegment(startPos, segmentEnd, aStart, audioEndSeconds, true)
                }
            }
        }
        const visibleLocalStart = (clip ? resultStart : range.unitMin) - rawStart
        const visibleLocalEnd = (clip ? resultEnd : range.unitMax) - rawStart
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
        // Interior warp segments - only iterate visible range
        const startIndex = Math.max(0, warpMarkers.floorLastIndex(visibleLocalStart))
        for (let i = startIndex; i < markers.length - 1; i++) {
            const w0 = markers[i]
            if (w0.position > visibleLocalEnd) {break}
            const w1 = markers[i + 1]
            addSegment(rawStart + w0.position, rawStart + w1.position, w0.seconds, w1.seconds)
        }
        // Extrapolate after the last warp marker
        if (extrapolateEndLocal > last.position) {
            const audioEnd = last.seconds + (extrapolateEndLocal - last.position) * lastRate
            addSegment(rawStart + last.position, rawStart + extrapolateEndLocal, last.seconds, audioEnd)
        }
    } else {
        if (clip) {
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
        } else {
            const loopDuration = rawEnd - rawStart
            const ppqnPerSecond = loopDuration / durationInSeconds
            const offsetPpqn = waveformOffset * ppqnPerSecond
            const waveStart = rawStart - offsetPpqn
            const waveEnd = rawEnd - offsetPpqn
            const addSegment = (posStart: number, posEnd: number, outside: boolean) => {
                if (posStart >= posEnd) {return}
                if (posEnd < range.unitMin || posStart > range.unitMax) {return}
                const clippedStart = Math.max(posStart, range.unitMin)
                const clippedEnd = Math.min(posEnd, range.unitMax)
                if (clippedStart >= clippedEnd) {return}
                const t0 = (clippedStart - waveStart) / (waveEnd - waveStart)
                const t1 = (clippedEnd - waveStart) / (waveEnd - waveStart)
                let u0 = t0 * numFrames
                let u1 = t1 * numFrames
                let x0 = range.unitToX(clippedStart) * devicePixelRatio
                let x1 = range.unitToX(clippedEnd) * devicePixelRatio
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
                    segments.push({x0, x1, u0, u1, outside})
                }
            }
            addSegment(waveStart, resultStart, true)
            addSegment(resultStart, resultEnd, false)
            addSegment(resultEnd, waveEnd, true)
        }
    }

    context.fillStyle = contentColor
    for (const {x0, x1, u0, u1, outside} of segments) {
        console.debug(x0, x1)
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