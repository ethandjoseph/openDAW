import {asDefined, assert, Bits, int, isInstanceOf, Nullable, Option, SortedSet, UUID} from "@opendaw/lib-std"
import {AudioBuffer, AudioData, EventCollection, LoopableRegion, RenderQuantum} from "@opendaw/lib-dsp"
import {
    AudioClipBoxAdapter,
    AudioRegionBoxAdapter,
    AudioWarpingBoxAdapter,
    TapeDeviceBoxAdapter,
    TrackBoxAdapter,
    TrackType,
    TransientMarkerBoxAdapter,
    WarpMarkerBoxAdapter
} from "@opendaw/studio-adapters"
import {AudioPlayback, TransientPlayMode} from "@opendaw/studio-enums"
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
            lane.voices.forEach(voice => voice.startFadeOut())
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
                        const optData = region.file.getOrCreateLoader().data
                        if (optData.isEmpty()) {return}
                        const playback = region.playback.getValue()
                        if (playback === AudioPlayback.Timestretch) {
                            const optWarping = region.warping
                            if (optWarping.isEmpty()) {return}
                            for (const cycle of LoopableRegion.locateLoops(region, p0, p1)) {
                                this.#processPassTimestretch(lane, block, cycle, optData.unwrap(), optWarping.unwrap())
                            }
                        } else {
                            for (const cycle of LoopableRegion.locateLoops(region, p0, p1)) {
                                this.#processPassPitch(lane, block, cycle, optData.unwrap(), region.warping, playback)
                            }
                        }
                    }
                },
                some: clip => {
                    if (!isInstanceOf(clip, AudioClipBoxAdapter)) {return}
                    const optData = clip.file.getOrCreateLoader().data
                    if (optData.isEmpty()) {return}
                    const playback = clip.playback.getValue()
                    if (playback === AudioPlayback.Timestretch) {
                        const optWarping = clip.warping
                        if (optWarping.isEmpty()) {return}
                        for (const cycle of LoopableRegion.locateLoops({
                            position: 0.0,
                            loopDuration: clip.duration,
                            loopOffset: 0.0,
                            complete: Number.POSITIVE_INFINITY
                        }, sectionFrom, sectionTo)) {
                            this.#processPassTimestretch(lane, block, cycle, optData.unwrap(), optWarping.unwrap())
                        }
                    } else {
                        for (const cycle of LoopableRegion.locateLoops({
                            position: 0.0,
                            loopDuration: clip.duration,
                            loopOffset: 0.0,
                            complete: Number.POSITIVE_INFINITY
                        }, sectionFrom, sectionTo)) {
                            this.#processPassPitch(lane, block, cycle, optData.unwrap(), clip.warping, playback)
                        }
                    }
                }
            })
        }
    }

    #processPassPitch(lane: Lane,
                      block: Block,
                      cycle: LoopableRegion.LoopCycle,
                      data: AudioData,
                      optWarping: Option<AudioWarpingBoxAdapter>,
                      playback: AudioPlayback): void {
        const {p0, p1, s0, s1, flags} = block
        const sn = s1 - s0
        const pn = p1 - p0
        const r0 = (cycle.resultStart - p0) / pn
        const r1 = (cycle.resultEnd - p0) / pn
        const bp0 = s0 + sn * r0
        const bp1 = s0 + sn * r1
        const bpn = (bp1 - bp0) | 0
        assert(s0 <= bp0 && bp1 <= s1, () => `Out of bounds ${bp0}, ${bp1}`)
        if (Bits.some(flags, BlockFlag.discontinuous)) {
            lane.voices.forEach(voice => voice.startFadeOut())
        }
        if (optWarping.isEmpty() || playback === AudioPlayback.NoSync) {
            const audioDurationSamples = data.numberOfFrames
            const audioDurationNormalized = cycle.resultEndValue - cycle.resultStartValue
            const audioSamplesInCycle = audioDurationNormalized * audioDurationSamples
            const timelineSamplesInCycle = (cycle.resultEnd - cycle.resultStart) / pn * sn
            const playbackRate = audioSamplesInCycle / timelineSamplesInCycle
            const offset = cycle.resultStartValue * data.numberOfFrames
            this.#updateOrCreatePitchVoice(lane, data, playbackRate, offset)
        } else {
            const warping = optWarping.unwrap()
            const {warpMarkers} = warping
            const firstWarp = warpMarkers.first()
            const lastWarp = warpMarkers.last()
            if (firstWarp === null || lastWarp === null) {
                lane.voices.forEach(voice => voice.startFadeOut())
                return
            }
            const contentPpqn = cycle.resultStart - cycle.rawStart
            if (contentPpqn < firstWarp.position || contentPpqn >= lastWarp.position) {
                lane.voices.forEach(voice => voice.startFadeOut())
                return
            }
            const currentSeconds = this.#ppqnToSeconds(contentPpqn, cycle.resultStartValue, warpMarkers)
            const offset = currentSeconds * data.sampleRate
            const playbackRate = this.#getPlaybackRateFromWarp(contentPpqn, warpMarkers, data.sampleRate, pn, sn)
            this.#updateOrCreatePitchVoice(lane, data, playbackRate, offset)
        }
        for (const voice of lane.voices) {
            voice.process(bp0 | 0, bpn)
        }
        lane.voices = lane.voices.filter(voice => !voice.done())
    }

    #updateOrCreatePitchVoice(lane: Lane, data: AudioData, playbackRate: number, offset: number): void {
        if (lane.voices.length === 0) {
            lane.voices.push(new PitchVoice(this.#audioOutput, data, FADE_LENGTH, playbackRate, offset))
        } else {
            let hasActiveVoice = false
            for (const voice of lane.voices) {
                if (voice instanceof PitchVoice) {
                    if (voice.isFadingOut()) {
                        continue
                    }
                    const drift = Math.abs(voice.readPosition - offset)
                    if (drift > FADE_LENGTH) {
                        voice.startFadeOut()
                    } else {
                        voice.setPlaybackRate(playbackRate)
                        hasActiveVoice = true
                    }
                }
            }
            if (!hasActiveVoice) {
                lane.voices.push(new PitchVoice(this.#audioOutput, data, FADE_LENGTH, playbackRate, offset))
            }
        }
    }

    #processPassTimestretch(lane: Lane,
                            block: Block,
                            cycle: LoopableRegion.LoopCycle,
                            data: AudioData,
                            warping: AudioWarpingBoxAdapter): void {
        const {p0, p1, s0, s1, flags} = block
        if (Bits.some(flags, BlockFlag.discontinuous)) {
            lane.lastTransientIndex = -1
            lane.voices.forEach(voice => voice.startFadeOut())
        }
        const sn = s1 - s0
        const pn = p1 - p0
        const r0 = (cycle.resultStart - p0) / pn
        const r1 = (cycle.resultEnd - p0) / pn
        const bp0 = s0 + sn * r0
        const bp1 = s0 + sn * r1
        const bpn = (bp1 - bp0) | 0
        assert(s0 <= bp0 && bp1 <= s1, () => `Out of bounds ${bp0}, ${bp1}`)
        const {warpMarkers, transientMarkers} = warping
        const firstWarp = asDefined(warpMarkers.first(), "missing first warp marker")
        const lastWarp = asDefined(warpMarkers.last(), "missing last warp marker")
        const contentPpqn = cycle.resultStart - cycle.rawStart
        if (contentPpqn < firstWarp.position || contentPpqn >= lastWarp.position) {return}
        const currentSeconds = this.#ppqnToSeconds(contentPpqn, cycle.resultStartValue, warpMarkers)
        const transientIndex = transientMarkers.floorLastIndex(currentSeconds)
        if (transientIndex !== lane.lastTransientIndex) {
            const segmentInfo = this.#getSegmentInfo(transientIndex, transientMarkers, data)
            if (segmentInfo !== null) {
                const {segment, hasNext, nextTransientSeconds} = segmentInfo
                const segmentLength = segment.end - segment.start
                if (segmentLength >= FADE_LENGTH * 2) {
                    lane.voices.forEach(voice => voice.startFadeOut())
                    const offsetInSegment = currentSeconds * data.sampleRate - segment.start
                    const startAtBeginning = lane.lastTransientIndex === -1 || transientIndex !== lane.lastTransientIndex + 1
                    const offset = startAtBeginning ? 0.0 : Math.max(0.0, offsetInSegment)
                    const playMode = this.#adapter.box.transientPlayMode.getValue() as TransientPlayMode
                    let canLoop = false
                    if (hasNext && playMode !== TransientPlayMode.Once) {
                        const nextPpqn = this.#secondsToPpqn(nextTransientSeconds, warpMarkers)
                        const ppqnUntilNext = nextPpqn - contentPpqn
                        const samplesPerPpqn = bpn / pn
                        const samplesNeeded = ppqnUntilNext * samplesPerPpqn
                        const samplesAvailable = segmentLength
                        const loopLength = samplesAvailable - (LOOP_START_MARGIN + LOOP_END_MARGIN)
                        canLoop = samplesNeeded > samplesAvailable * 1.01 && loopLength >= LOOP_MIN_LENGTH_SAMPLES
                    }
                    if (playMode === TransientPlayMode.Once || !canLoop) {
                        lane.voices.push(new OnceVoice(this.#audioOutput, data, segment, FADE_LENGTH, offset))
                    } else if (playMode === TransientPlayMode.Repeat) {
                        lane.voices.push(new RepeatVoice(this.#audioOutput, data, segment, FADE_LENGTH, offset))
                    } else {
                        lane.voices.push(new PingpongVoice(this.#audioOutput, data, segment, FADE_LENGTH, offset))
                    }
                }
            }
            lane.lastTransientIndex = transientIndex
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