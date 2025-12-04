import {asDefined, assert, Bits, int, isInstanceOf, isNull, Nullable, Option, SortedSet, UUID} from "@opendaw/lib-std"
import {AudioBuffer, AudioData, EventCollection, LoopableRegion, RenderQuantum} from "@opendaw/lib-dsp"
import {
    AudioClipBoxAdapter,
    AudioContentBoxAdapter,
    AudioRegionBoxAdapter,
    AudioTimeStretchBoxAdapter,
    TapeDeviceBoxAdapter,
    TrackBoxAdapter,
    TrackType,
    TransientMarkerBoxAdapter,
    WarpMarkerBoxAdapter
} from "@opendaw/studio-adapters"
import {TransientPlayMode} from "@opendaw/studio-enums"
import {EngineContext} from "../../EngineContext"
import {AudioGenerator, Block, BlockFlag, ProcessInfo, Processor} from "../../processing"
import {AbstractProcessor} from "../../AbstractProcessor"
import {PeakBroadcaster} from "../../PeakBroadcaster"
import {AutomatableParameter} from "../../AutomatableParameter"
import {DeviceProcessor} from "../../DeviceProcessor"
import {NoteEventTarget} from "../../NoteEventSource"
import {Segment} from "./Tape/Segment"
import {FADE_LENGTH, LOOP_END_MARGIN, LOOP_MIN_LENGTH_SAMPLES, LOOP_START_MARGIN} from "./Tape/constants"
import {OnceVoice} from "./Tape/OnceVoice"
import {RepeatVoice} from "./Tape/RepeatVoice"
import {PingpongVoice} from "./Tape/PingpongVoice"
import {PitchVoice} from "./Tape/PitchVoice"
import {Voice} from "./Tape/Voice"

type SegmentInfo = {
    segment: Segment
    hasNext: boolean
    nextTransientSeconds: number
}

type Lane = {
    adapter: TrackBoxAdapter
    voices: Array<Voice>
    lastTransientIndex: int
}

export class TapeDeviceProcessor extends AbstractProcessor implements DeviceProcessor, AudioGenerator {
    readonly #adapter: TapeDeviceBoxAdapter
    readonly #audioOutput: AudioBuffer
    readonly #peaks: PeakBroadcaster
    readonly #lanes: SortedSet<UUID.Bytes, Lane>

    constructor(context: EngineContext, adapter: TapeDeviceBoxAdapter) {
        super(context)

        this.#adapter = adapter
        this.#audioOutput = new AudioBuffer(2)
        this.#peaks = this.own(new PeakBroadcaster(context.broadcaster, adapter.address))
        this.#lanes = UUID.newSet<Lane>(({adapter: {uuid}}) => uuid)
        this.ownAll(
            this.#adapter.deviceHost().audioUnitBoxAdapter().tracks.catchupAndSubscribe({
                onAdd: (adapter: TrackBoxAdapter) => this.#lanes.add({adapter, voices: [], lastTransientIndex: -1}),
                onRemove: (adapter: TrackBoxAdapter) => this.#lanes.removeByKey(adapter.uuid),
                onReorder: (_adapter: TrackBoxAdapter) => {}
            }),
            context.registerProcessor(this)
        )
    }

    // false negative Webstorm
    // noinspection JSUnusedGlobalSymbols
    get noteEventTarget(): Option<NoteEventTarget & DeviceProcessor> {return Option.None}
    get uuid(): UUID.Bytes {return this.#adapter.uuid}
    get incoming(): Processor {return this}
    get outgoing(): Processor {return this}
    get audioOutput(): AudioBuffer {return this.#audioOutput}

    reset(): void {
        this.#peaks.clear()
        this.#audioOutput.clear()
        this.eventInput.clear()
        this.#lanes.forEach(lane => {
            lane.voices = []
            lane.lastTransientIndex = -1
        })
    }

    process({blocks}: ProcessInfo): void {
        this.#audioOutput.clear(0, RenderQuantum)
        this.#lanes.forEach(lane => blocks.forEach(block => this.#processBlock(lane, block)))
        this.#audioOutput.assertSanity()
        const [outL, outR] = this.#audioOutput.channels()
        this.#peaks.process(outL, outR)
    }

    parameterChanged(_parameter: AutomatableParameter): void {}

    #processBlock(lane: Lane, block: Block): void {
        const {adapter} = lane
        if (adapter.type !== TrackType.Audio || !adapter.enabled.getValue()) {
            lane.voices.forEach(voice => voice.startFadeOut(0))
            lane.lastTransientIndex = -1
            return
        }
        const {p0, p1, flags} = block
        if (!Bits.every(flags, BlockFlag.transporting | BlockFlag.playing)) {return}
        const intervals = this.context.clipSequencing.iterate(adapter.uuid, p0, p1)
        for (const {optClip, sectionFrom, sectionTo} of intervals) {
            optClip.match({
                none: () => {
                    for (const region of adapter.regions.collection.iterateRange(p0, p1)) {
                        if (region.mute || !isInstanceOf(region, AudioRegionBoxAdapter)) {continue}
                        const file = region.file
                        const optData = file.getOrCreateLoader().data
                        if (optData.isEmpty()) {return}
                        const waveformOffset = region.waveformOffset.getValue()
                        const timeStretch = region.asPlayModeTimeStretch
                        if (timeStretch.nonEmpty()) {
                            const transients: EventCollection<TransientMarkerBoxAdapter> = file.transients
                            if (transients.length() < 2) {return}
                            for (const cycle of LoopableRegion.locateLoops(region, p0, p1)) {
                                const timeStretchBoxAdapter = timeStretch.unwrap()
                                this.#processPassTimestretch(lane, block, cycle,
                                    optData.unwrap(), timeStretchBoxAdapter, transients, waveformOffset)
                            }
                        } else {
                            for (const cycle of LoopableRegion.locateLoops(region, p0, p1)) {
                                this.#processPassPitch(
                                    lane, block, cycle, region, optData.unwrap())
                            }
                        }
                    }
                },
                some: clip => {
                    if (!isInstanceOf(clip, AudioClipBoxAdapter)) {return}
                    const file = clip.file
                    const optData = file.getOrCreateLoader().data
                    if (optData.isEmpty()) {return}
                    const asPlayModeTimeStretch = clip.asPlayModeTimeStretch
                    if (asPlayModeTimeStretch.nonEmpty()) {
                        const timeStretch = asPlayModeTimeStretch.unwrap()
                        const transients: EventCollection<TransientMarkerBoxAdapter> = file.transients
                        if (transients.length() < 2) {return}
                        for (const cycle of LoopableRegion.locateLoops({
                            position: 0.0,
                            loopDuration: clip.duration,
                            loopOffset: 0.0,
                            complete: Number.POSITIVE_INFINITY
                        }, sectionFrom, sectionTo)) {
                            this.#processPassTimestretch(lane, block, cycle, optData.unwrap(),
                                timeStretch, transients, clip.waveformOffset.getValue())
                        }
                    } else {
                        for (const cycle of LoopableRegion.locateLoops({
                            position: 0.0,
                            loopDuration: clip.duration,
                            loopOffset: 0.0,
                            complete: Number.POSITIVE_INFINITY
                        }, sectionFrom, sectionTo)) {
                            this.#processPassPitch(lane, block, cycle, clip, optData.unwrap())
                        }
                    }
                }
            })
        }
    }

    #processPassPitch(lane: Lane,
                      block: Block,
                      cycle: LoopableRegion.LoopCycle,
                      adapter: AudioContentBoxAdapter,
                      data: AudioData): void {
        const {p0, p1, s0, s1, flags} = block
        const sn = s1 - s0
        const pn = p1 - p0
        const r0 = (cycle.resultStart - p0) / pn
        const r1 = (cycle.resultEnd - p0) / pn
        const bp0 = s0 + sn * r0
        const bp1 = s0 + sn * r1
        const bpn = (bp1 - bp0) | 0
        const waveformOffset: number = adapter.waveformOffset.getValue()
        assert(s0 <= bp0 && bp1 <= s1, () => `Out of bounds ${bp0}, ${bp1}`)
        if (Bits.some(flags, BlockFlag.discontinuous)) {
            lane.voices.forEach(voice => voice.startFadeOut(0))
            lane.lastTransientIndex = -1
        }
        const asPlayModePitch = adapter.asPlayModePitch
        if (asPlayModePitch.isEmpty() || adapter.observableOptPlayMode.isEmpty()) {
            const audioDurationSamples = data.numberOfFrames
            const audioDurationNormalized = cycle.resultEndValue - cycle.resultStartValue
            const audioSamplesInCycle = audioDurationNormalized * audioDurationSamples
            const timelineSamplesInCycle = (cycle.resultEnd - cycle.resultStart) / pn * sn
            const playbackRate = audioSamplesInCycle / timelineSamplesInCycle
            const offset = cycle.resultStartValue * data.numberOfFrames + waveformOffset * data.sampleRate
            this.#updateOrCreatePitchVoice(lane, data, playbackRate, offset, 0)
        } else {
            const pitchBoxAdapter = asPlayModePitch.unwrap()
            const warpMarkers = pitchBoxAdapter.warpMarkers
            const firstWarp = warpMarkers.first()
            const lastWarp = warpMarkers.last()
            if (firstWarp === null || lastWarp === null) {
                lane.voices.forEach(voice => voice.startFadeOut(0))
                return
            }
            const contentPpqn = cycle.resultStart - cycle.rawStart
            if (contentPpqn < firstWarp.position || contentPpqn >= lastWarp.position) {
                lane.voices.forEach(voice => voice.startFadeOut(0))
                return
            }
            const currentSeconds = this.#ppqnToSeconds(contentPpqn, cycle.resultStartValue, warpMarkers)
            const playbackRate = this.#getPlaybackRateFromWarp(contentPpqn, warpMarkers, data.sampleRate, pn, sn)
            const offset = (currentSeconds + waveformOffset) * data.sampleRate
            this.#updateOrCreatePitchVoice(lane, data, playbackRate, offset, 0)
        }
        for (const voice of lane.voices) {
            voice.process(bp0 | 0, bpn)
        }
        lane.voices = lane.voices.filter(voice => !voice.done())
    }

    #updateOrCreatePitchVoice(lane: Lane, data: AudioData, playbackRate: number, offset: number, blockOffset: int): void {
        if (lane.voices.length === 0) {
            lane.voices.push(new PitchVoice(this.#audioOutput, data, FADE_LENGTH, playbackRate, offset, blockOffset))
        } else {
            let hasActiveVoice = false
            for (const voice of lane.voices) {
                if (voice instanceof PitchVoice) {
                    if (voice.isFadingOut()) {
                        continue
                    }
                    const drift = Math.abs(voice.readPosition - offset)
                    if (drift > FADE_LENGTH) {
                        voice.startFadeOut(blockOffset)
                    } else {
                        voice.setPlaybackRate(playbackRate)
                        hasActiveVoice = true
                    }
                } else {
                    // Fade out non-PitchVoice voices (OnceVoice, RepeatVoice, PingpongVoice)
                    voice.startFadeOut(blockOffset)
                }
            }
            if (!hasActiveVoice) {
                lane.voices.push(new PitchVoice(this.#audioOutput, data, FADE_LENGTH, playbackRate, offset, blockOffset))
            }
        }
    }

    #processPassTimestretch(lane: Lane,
                            block: Block,
                            cycle: LoopableRegion.LoopCycle,
                            data: AudioData,
                            timeStretch: AudioTimeStretchBoxAdapter,
                            transients: EventCollection<TransientMarkerBoxAdapter>,
                            waveformOffset: number): void {
        const {p0, p1, s0, s1, flags} = block
        if (Bits.some(flags, BlockFlag.discontinuous)) {
            lane.lastTransientIndex = -1
            lane.voices.forEach(voice => voice.startFadeOut(0))
        }
        // Fade out any PitchVoice when in timestretch mode
        for (const voice of lane.voices) {
            if (voice instanceof PitchVoice) {
                voice.startFadeOut(0)
            }
        }
        const sn = s1 - s0
        const pn = p1 - p0
        const r0 = (cycle.resultStart - p0) / pn
        const r1 = (cycle.resultEnd - p0) / pn
        const bp0 = s0 + sn * r0
        const bp1 = s0 + sn * r1
        const bpn = (bp1 - bp0) | 0
        const warpMarkers = timeStretch.warpMarkers
        const transientPlayMode = timeStretch.transientPlayMode
        assert(s0 <= bp0 && bp1 <= s1, () => `Out of bounds ${bp0}, ${bp1}`)
        const firstWarp = asDefined(warpMarkers.first(), "missing first warp marker")
        const lastWarp = asDefined(warpMarkers.last(), "missing last warp marker")
        const contentPpqn = cycle.resultStart - cycle.rawStart
        if (contentPpqn < firstWarp.position || contentPpqn >= lastWarp.position) {return}
        const warpSeconds = this.#ppqnToSeconds(contentPpqn, cycle.resultStartValue, warpMarkers)
        const fileSeconds = warpSeconds + waveformOffset
        // Clamp to valid file range
        if (fileSeconds < 0.0 || fileSeconds >= data.numberOfFrames / data.sampleRate) {return}
        // Check for transient boundaries within this block by looking at file position at block END
        const contentPpqnEnd = contentPpqn + pn
        const warpSecondsEnd = this.#ppqnToSeconds(contentPpqnEnd, cycle.resultEndValue, warpMarkers)
        const fileSecondsEnd = warpSecondsEnd + waveformOffset
        const transientIndexAtEnd = transients.floorLastIndex(fileSecondsEnd)

        // Detect loop restart: if we're now at a lower transient index than before, reset
        if (transientIndexAtEnd < lane.lastTransientIndex) {
            lane.lastTransientIndex = -1
            lane.voices.forEach(voice => voice.startFadeOut(0))
        }

        // Process if we'll cross into a new transient during this block
        if (transientIndexAtEnd !== lane.lastTransientIndex) {
            // Find the next transient boundary we'll cross
            const nextTransientIndex = lane.lastTransientIndex === -1 ? transientIndexAtEnd : lane.lastTransientIndex + 1
            const nextTransient = transients.optAt(nextTransientIndex)

            if (nextTransient !== null) {
                const segmentInfo = this.#getSegmentInfo(nextTransientIndex, transients, data)
                if (isNull(segmentInfo)) {return}
                const {segment, hasNext, nextTransientSeconds} = segmentInfo
                const segmentLength = segment.end - segment.start

                if (segmentLength >= FADE_LENGTH * 2) {
                    // Calculate blockOffset: where in the output buffer does this transient start?
                    const transientWarpSeconds = nextTransient.position - waveformOffset
                    const transientPpqn = this.#secondsToPpqn(transientWarpSeconds, warpMarkers)
                    const ppqnIntoBlock = transientPpqn - contentPpqn
                    // Calculate block offset - transient should fall within [0, pn] range now
                    const blockOffset = Math.max(0, Math.min(bpn - 1, ((ppqnIntoBlock / pn) * bpn) | 0))
                    lane.voices.forEach(voice => voice.startFadeOut(blockOffset))
                    let canLoop = false
                    if (hasNext && transientPlayMode !== TransientPlayMode.Once) {
                        const nextNextWarpSeconds = nextTransientSeconds - waveformOffset
                        const nextNextPpqn = this.#secondsToPpqn(nextNextWarpSeconds, warpMarkers)
                        // If nextNextPpqn is 0, the next transient is beyond warp markers - use lastWarp as endpoint
                        const endPpqn = nextNextPpqn > transientPpqn ? nextNextPpqn : lastWarp.position
                        const ppqnUntilNext = endPpqn - transientPpqn
                        const samplesPerPpqn = bpn / pn
                        const samplesNeeded = ppqnUntilNext * samplesPerPpqn
                        const samplesAvailable = segmentLength
                        const loopLength = samplesAvailable - (LOOP_START_MARGIN + LOOP_END_MARGIN)
                        canLoop = samplesNeeded > samplesAvailable * 1.01 && loopLength >= LOOP_MIN_LENGTH_SAMPLES
                    }
                    if (transientPlayMode === TransientPlayMode.Once || !canLoop) {
                        lane.voices.push(new OnceVoice(this.#audioOutput, data, segment, FADE_LENGTH, blockOffset))
                    } else if (transientPlayMode === TransientPlayMode.Repeat) {
                        lane.voices.push(new RepeatVoice(this.#audioOutput, data, segment, FADE_LENGTH, blockOffset))
                    } else {
                        lane.voices.push(new PingpongVoice(this.#audioOutput, data, segment, FADE_LENGTH, blockOffset))
                    }
                }
                lane.lastTransientIndex = nextTransientIndex
            }
        }
        for (const voice of lane.voices) {
            voice.process(bp0 | 0, bpn)
        }
        lane.voices = lane.voices.filter(voice => !voice.done())
    }

    #getSegmentInfo(index: int, transientMarkers: EventCollection<TransientMarkerBoxAdapter>, data: AudioData): Nullable<SegmentInfo> {
        const current = transientMarkers.optAt(index)
        if (current === null) {return null}
        const next = transientMarkers.optAt(index + 1)
        const start = current.position * data.sampleRate
        const end = next !== null ? next.position * data.sampleRate : data.numberOfFrames
        return {
            segment: {start, end},
            hasNext: next !== null,
            nextTransientSeconds: next !== null ? next.position : Number.POSITIVE_INFINITY
        }
    }

    #getPlaybackRateFromWarp(ppqn: number,
                             warpMarkers: EventCollection<WarpMarkerBoxAdapter>,
                             sampleRate: number, pn: number, sn: number): number {
        const leftIndex = warpMarkers.floorLastIndex(ppqn)
        const left = warpMarkers.optAt(leftIndex)
        const right = warpMarkers.optAt(leftIndex + 1)
        if (left === null || right === null) {
            return 1.0
        }
        const ppqnDelta = right.position - left.position
        const secondsDelta = right.seconds - left.seconds
        const samplesDelta = secondsDelta * sampleRate
        const audioSamplesPerPpqn = samplesDelta / ppqnDelta
        const timelineSamplesPerPpqn = sn / pn
        return audioSamplesPerPpqn / timelineSamplesPerPpqn
    }

    #secondsToPpqn(seconds: number, warpMarkers: EventCollection<WarpMarkerBoxAdapter>): number {
        for (let i = 0; i < warpMarkers.length() - 1; i++) {
            const left = warpMarkers.optAt(i)
            const right = warpMarkers.optAt(i + 1)
            if (left === null || right === null) {continue}
            if (seconds >= left.seconds && seconds < right.seconds) {
                const alpha = (seconds - left.seconds) / (right.seconds - left.seconds)
                return left.position + alpha * (right.position - left.position)
            }
        }
        return 0.0
    }

    #ppqnToSeconds(ppqn: number, normalizedFallback: number, warpMarkers: EventCollection<WarpMarkerBoxAdapter>): number {
        const leftIndex = warpMarkers.floorLastIndex(ppqn)
        const left = warpMarkers.optAt(leftIndex)
        const right = warpMarkers.optAt(leftIndex + 1)
        if (left === null || right === null) {return normalizedFallback}
        const alpha = (ppqn - left.position) / (right.position - left.position)
        return left.seconds + alpha * (right.seconds - left.seconds)
    }
}