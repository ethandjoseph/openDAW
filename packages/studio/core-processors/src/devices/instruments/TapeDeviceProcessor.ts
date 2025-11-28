import {asDefined, assert, Bits, int, isInstanceOf, Nullable, Option, SortedSet, UUID} from "@opendaw/lib-std"
import {AudioBuffer, AudioData, EventCollection, LoopableRegion, RenderQuantum} from "@opendaw/lib-dsp"
import {
    AudioClipBoxAdapter,
    AudioRegionBoxAdapter,
    AudioWarpingBoxAdapter,
    SampleLoader,
    TapeDeviceBoxAdapter,
    TrackBoxAdapter,
    TrackType,
    TransientMarkerBoxAdapter,
    WarpMarkerBoxAdapter
} from "@opendaw/studio-adapters"
import {EngineContext} from "../../EngineContext"
import {AudioGenerator, Block, BlockFlag, ProcessInfo, Processor} from "../../processing"
import {AbstractProcessor} from "../../AbstractProcessor"
import {PeakBroadcaster} from "../../PeakBroadcaster"
import {AutomatableParameter} from "../../AutomatableParameter"
import {DeviceProcessor} from "../../DeviceProcessor"
import {NoteEventTarget} from "../../NoteEventSource"
import {TransientPlayMode} from "@opendaw/studio-enums"

const enum VoiceState { FadingIn, Active, FadingOut, Done }

const enum PlayDirection { Forward = 1, Backward = -1 }

const FADE_LENGTH = 256
const LOOP_START_MARGIN_SECONDS = 0.080
const LOOP_END_MARGIN_SECONDS = 0.010

type Bounds = { left: number, right: number }
type Lane = {
    adapter: TrackBoxAdapter
    voices: Array<StretchVoice>
    lastTransientIndex: int
}

class StretchVoice {
    readonly playMode: TransientPlayMode
    readonly #fadeLength: number
    readonly #canLoop: boolean

    state: VoiceState = VoiceState.Done
    direction: PlayDirection = PlayDirection.Forward
    readPosition: number = 0
    segmentStart: number
    segmentEnd: number
    loopStart: number
    loopEnd: number
    playbackRate: number
    fadeProgress: number

    constructor(segmentStart: number,
                segmentEnd: number,
                loopStartMargin: number,
                loopEndMargin: number,
                playMode: TransientPlayMode,
                fadeLength: number,
                playbackRate: number,
                offset: number = 0.0) {
        this.segmentStart = segmentStart
        this.segmentEnd = segmentEnd
        this.playMode = playMode
        this.playbackRate = playbackRate
        this.#fadeLength = fadeLength
        this.loopStart = segmentStart + loopStartMargin
        this.loopEnd = segmentEnd - loopEndMargin
        this.#canLoop = this.loopEnd > this.loopStart
        if (!this.#canLoop) {
            this.loopStart = segmentStart
            this.loopEnd = segmentEnd
        }
        this.fadeProgress = 0.0
        this.#initializePosition(offset)
    }

    #initializePosition(offset: number): void {
        if (offset <= 0.0) {
            this.state = VoiceState.FadingIn
            this.direction = PlayDirection.Forward
            this.readPosition = this.segmentStart
            return
        }
        this.state = VoiceState.Active
        if (this.playMode === TransientPlayMode.Once || !this.#canLoop) {
            this.direction = PlayDirection.Forward
            this.readPosition = this.segmentStart + offset
            if (this.readPosition >= this.segmentEnd) {
                this.state = VoiceState.Done
            }
            return
        }
        const firstPassLength = this.loopEnd - this.segmentStart
        if (offset < firstPassLength) {
            this.direction = PlayDirection.Forward
            this.readPosition = this.segmentStart + offset
            return
        }
        const loopLength = this.loopEnd - this.loopStart
        const loopOffset = offset - firstPassLength
        const passCount = Math.floor(loopOffset / loopLength)
        const positionInPass = loopOffset % loopLength
        if (this.playMode === TransientPlayMode.Repeat) {
            this.direction = PlayDirection.Forward
            this.readPosition = this.loopStart + positionInPass
        } else {
            if (passCount % 2 === 0) {
                this.direction = PlayDirection.Backward
                this.readPosition = this.loopEnd - positionInPass
            } else {
                this.direction = PlayDirection.Forward
                this.readPosition = this.loopStart + positionInPass
            }
        }
    }

    startFadeOut(): void {
        if (this.state !== VoiceState.Done && this.state !== VoiceState.FadingOut) {
            this.state = VoiceState.FadingOut
            this.fadeProgress = 0.0
        }
    }

    process(outL: Float32Array, outR: Float32Array, framesL: Float32Array, framesR: Float32Array,
            numberOfFrames: number, bufferStart: number, bufferCount: number): void {
        for (let i = 0; i < bufferCount; i++) {
            if (this.state === VoiceState.Done) {break}
            const j = bufferStart + i
            const amplitude = this.#calculateAmplitude()
            const sample = this.#readSample(framesL, framesR, numberOfFrames)
            outL[j] += sample.left * amplitude
            outR[j] += sample.right * amplitude
            this.#advance()
        }
    }

    #calculateAmplitude(): number {
        switch (this.state) {
            case VoiceState.FadingIn: {
                const amp = this.fadeProgress / this.#fadeLength
                if (++this.fadeProgress >= this.#fadeLength) {
                    this.state = VoiceState.Active
                    this.fadeProgress = 0.0
                }
                return amp
            }
            case VoiceState.FadingOut: {
                const amp = 1.0 - this.fadeProgress / this.#fadeLength
                if (++this.fadeProgress >= this.#fadeLength) {
                    this.state = VoiceState.Done
                }
                return amp
            }
            case VoiceState.Active:
                return 1.0
            case VoiceState.Done:
                return 0.0
        }
    }

    #readSample(framesL: Float32Array, framesR: Float32Array, numberOfFrames: number): Bounds {
        const readInt = this.readPosition | 0
        if (readInt < 0 || readInt >= numberOfFrames - 1) {
            return {left: 0.0, right: 0.0}
        }
        const alpha = this.readPosition - readInt
        const fL = framesL[readInt]
        const fR = framesR[readInt]
        return {
            left: fL + alpha * (framesL[readInt + 1] - fL),
            right: fR + alpha * (framesR[readInt + 1] - fR)
        }
    }

    #advance(): void {
        if (this.state === VoiceState.Done) {return}
        if (this.state === VoiceState.FadingOut) {
            this.readPosition += this.direction * this.playbackRate
            return
        }
        this.readPosition += this.direction * this.playbackRate
        if (this.playMode === TransientPlayMode.Once || !this.#canLoop) {
            const distanceToEnd = this.direction === PlayDirection.Forward
                ? this.segmentEnd - this.readPosition
                : this.readPosition - this.segmentStart
            if (distanceToEnd <= this.#fadeLength * this.playbackRate) {
                this.startFadeOut()
            }
            return
        }
        if (this.playMode === TransientPlayMode.Pingpong) {
            if (this.direction === PlayDirection.Forward && this.readPosition >= this.loopEnd) {
                this.direction = PlayDirection.Backward
                const overshoot = this.readPosition - this.loopEnd
                this.readPosition = this.loopEnd - overshoot
            } else if (this.direction === PlayDirection.Backward && this.readPosition < this.loopStart) {
                this.direction = PlayDirection.Forward
                const overshoot = this.loopStart - this.readPosition
                this.readPosition = this.loopStart + overshoot
            }
        } else {
            if (this.readPosition >= this.segmentEnd + this.#fadeLength * this.playbackRate) {
                this.readPosition = this.loopStart + (this.readPosition - this.segmentEnd)
            }
        }
    }
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

    reset(): void {
        this.#peaks.clear()
        this.#audioOutput.clear()
        this.eventInput.clear()
        this.#lanes.forEach(lane => {
            lane.voices = []
            lane.lastTransientIndex = -1
        })
    }

    get uuid(): UUID.Bytes {return this.#adapter.uuid}
    get incoming(): Processor {return this}
    get outgoing(): Processor {return this}
    get audioOutput(): AudioBuffer {return this.#audioOutput}

    process({blocks}: ProcessInfo): void {
        this.#audioOutput.clear(0, RenderQuantum)
        const [outL, outR] = this.#audioOutput.channels()
        this.#lanes.forEach(lane => blocks.forEach((block) => {
            const {adapter} = lane
            if (adapter.type !== TrackType.Audio || !adapter.enabled.getValue()) {
                lane.voices.forEach(v => v.startFadeOut())
                return
            }
            const {p0, p1, flags} = block
            if (!Bits.every(flags, BlockFlag.transporting | BlockFlag.playing)) {return}
            const playMode = this.#adapter.box.transientPlayMode.getValue()
            const intervals = this.context.clipSequencing.iterate(adapter.uuid, p0, p1)
            for (const {optClip, sectionFrom, sectionTo} of intervals) {
                optClip.match({
                    none: () => {
                        for (const region of adapter.regions.collection.iterateRange(p0, p1)) {
                            if (region.mute || !isInstanceOf(region, AudioRegionBoxAdapter)) {continue}
                            const loader: SampleLoader = region.file.getOrCreateLoader()
                            const optData = loader.data
                            if (optData.isEmpty()) {return}
                            const data = optData.unwrap()
                            const optWarping = region.warping
                            for (const cycle of LoopableRegion.locateLoops(region, p0, p1)) {
                                this.#processPass(outL, outR, data, optWarping, cycle, block, lane, playMode)
                            }
                        }
                    },
                    some: clip => {
                        if (!isInstanceOf(clip, AudioClipBoxAdapter)) {return}
                        const optData = clip.file.getOrCreateLoader().data
                        if (optData.isEmpty()) {return}
                        const data = optData.unwrap()
                        const optWarping = clip.warping
                        for (const cycle of LoopableRegion.locateLoops({
                            position: 0.0,
                            loopDuration: clip.duration,
                            loopOffset: 0.0,
                            complete: Number.POSITIVE_INFINITY
                        }, sectionFrom, sectionTo)) {
                            this.#processPass(outL, outR, data, optWarping, cycle, block, lane, playMode)
                        }
                    }
                })
            }
        }))
        this.#audioOutput.assertSanity()
        this.#peaks.process(outL, outR)
    }

    parameterChanged(_parameter: AutomatableParameter): void {}

    #processPass(outL: Float32Array, outR: Float32Array,
                 data: AudioData,
                 optWarping: Option<AudioWarpingBoxAdapter>,
                 cycle: LoopableRegion.LoopCycle,
                 {p0, p1, s0, s1, flags}: Block,
                 lane: Lane,
                 playMode: TransientPlayMode): void {
        if (Bits.some(flags, BlockFlag.discontinuous)) {
            this.#lanes.forEach(lane => {
                lane.lastTransientIndex = -1
                lane.voices.forEach(v => v.startFadeOut())
            })
        }
        const {numberOfFrames, frames, sampleRate: fileSampleRate} = data
        const framesL = frames[0]
        const framesR = frames.length === 1 ? frames[0] : frames[1]
        const sn = s1 - s0
        const pn = p1 - p0
        const r0 = (cycle.resultStart - p0) / pn
        const r1 = (cycle.resultEnd - p0) / pn
        const bp0 = s0 + sn * r0
        const bp1 = s0 + sn * r1
        const bpn = (bp1 - bp0) | 0
        assert(s0 <= bp0 && bp1 <= s1, () => `Out of bounds ${bp0}, ${bp1}`)
        if (optWarping.isEmpty()) {
            const wp0 = numberOfFrames * cycle.resultStartValue
            const wp1 = numberOfFrames * cycle.resultEndValue
            const stepSize = (wp1 - wp0) / bpn
            this.#processWithoutWarping(outL, outR, framesL, framesR, numberOfFrames,
                fileSampleRate, bp0 | 0, bpn, wp0, stepSize, lane, playMode)
        } else {
            const warping = optWarping.unwrap()
            this.#processWithWarping(outL, outR, framesL, framesR, numberOfFrames,
                fileSampleRate, bp0 | 0, bpn, cycle, warping, lane, playMode)
        }
        lane.voices = lane.voices.filter(v => v.state !== VoiceState.Done)
    }

    #processWithoutWarping(outL: Float32Array, outR: Float32Array,
                           framesL: Float32Array, framesR: Float32Array, numberOfFrames: int, fileSampleRate: number,
                           bufferStart: int, bufferCount: int,
                           wp0: number, stepSize: number,
                           lane: Lane, playMode: TransientPlayMode): void {
        if (lane.voices.length === 0) {
            const loopStartMargin = Math.round(LOOP_START_MARGIN_SECONDS * fileSampleRate)
            const loopEndMargin = Math.round(LOOP_END_MARGIN_SECONDS * fileSampleRate)
            lane.voices.push(new StretchVoice(0, numberOfFrames, loopStartMargin, loopEndMargin,
                playMode, FADE_LENGTH, stepSize, wp0))
        }
        for (const voice of lane.voices) {
            voice.process(outL, outR, framesL, framesR, numberOfFrames, bufferStart, bufferCount)
        }
    }

    #processWithWarping(outL: Float32Array, outR: Float32Array,
                        framesL: Float32Array, framesR: Float32Array,
                        numberOfFrames: int, fileSampleRate: number, bufferStart: int,
                        bufferCount: int, cycle: LoopableRegion.LoopCycle,
                        warping: AudioWarpingBoxAdapter,
                        lane: Lane,
                        playMode: TransientPlayMode): void {
        const {warpMarkers, transientMarkers} = warping
        const firstWarp = asDefined(warpMarkers.first(), "there must be at least one warp marker (1st)")
        const lastWarp = asDefined(warpMarkers.last(), "there must be at least one warp marker (nth)")
        const contentPpqn = cycle.resultStart - cycle.rawStart
        if (contentPpqn < firstWarp.position || contentPpqn >= lastWarp.position) {
            return
        }
        const currentSeconds = this.#ppqnToSeconds(contentPpqn, cycle.resultStartValue, warpMarkers)
        const transientIndex = transientMarkers.floorLastIndex(currentSeconds)
        if (transientIndex !== lane.lastTransientIndex) {
            lane.voices.forEach(voice => voice.startFadeOut())
            const segment = this.#getTransientSegment(transientIndex, transientMarkers, numberOfFrames, fileSampleRate)
            if (segment !== null) {
                const offsetInSegment = currentSeconds * fileSampleRate - segment.start
                const startAtBeginning = transientIndex !== lane.lastTransientIndex + 1
                const loopStartMargin = Math.round(LOOP_START_MARGIN_SECONDS * fileSampleRate)
                const loopEndMargin = Math.round(LOOP_END_MARGIN_SECONDS * fileSampleRate)
                lane.voices.push(new StretchVoice(
                    segment.start, segment.end, loopStartMargin, loopEndMargin, playMode, FADE_LENGTH, 1.0,
                    startAtBeginning ? 0.0 : Math.max(0.0, offsetInSegment)
                ))
            }
            lane.lastTransientIndex = transientIndex
        }
        for (const voice of lane.voices) {
            voice.process(outL, outR, framesL, framesR, numberOfFrames, bufferStart, bufferCount)
        }
    }

    #getTransientSegment(index: int,
                         transientMarkers: EventCollection<TransientMarkerBoxAdapter>,
                         numberOfFrames: number,
                         fileSampleRate: number): Nullable<{ start: number, end: number }> {
        const current = transientMarkers.optAt(index)
        if (current === null) {
            return null
        }
        const next = transientMarkers.optAt(index + 1)
        const start = current.position * fileSampleRate
        const end = next !== null ? next.position * fileSampleRate : numberOfFrames
        return {start, end}
    }

    #ppqnToSeconds(ppqn: number, normalizedFallback: number,
                   warpMarkers: EventCollection<WarpMarkerBoxAdapter>): number {
        const leftIndex = warpMarkers.floorLastIndex(ppqn)
        const left = warpMarkers.optAt(leftIndex)
        const right = warpMarkers.optAt(leftIndex + 1)
        if (left === null || right === null) {
            return normalizedFallback
        }
        const alpha = (ppqn - left.position) / (right.position - left.position)
        return left.seconds + alpha * (right.seconds - left.seconds)
    }
}