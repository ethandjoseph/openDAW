import {assert, Bits, isInstanceOf, Option, UUID} from "@opendaw/lib-std"
import {LoopableRegion} from "@opendaw/lib-dsp"
import {
    AudioClipBoxAdapter,
    AudioData,
    AudioRegionBoxAdapter,
    SampleLoader,
    TapeDeviceBoxAdapter,
    TrackType
} from "@opendaw/studio-adapters"
import {RenderQuantum} from "../../constants"
import {EngineContext} from "../../EngineContext"
import {AudioGenerator, Block, BlockFlag, ProcessInfo, Processor} from "../../processing"
import {AbstractProcessor} from "../../AbstractProcessor"
import {AudioBuffer} from "../../AudioBuffer"
import {PeakBroadcaster} from "../../PeakBroadcaster"
import {AutomatableParameter} from "../../AutomatableParameter"
import {NoteEventTarget} from "../../NoteEventSource"
import {DeviceProcessor} from "../../DeviceProcessor"

export class TapeDeviceProcessor extends AbstractProcessor implements DeviceProcessor, AudioGenerator {
    readonly #adapter: TapeDeviceBoxAdapter
    readonly #audioOutput: AudioBuffer
    readonly #peaks: PeakBroadcaster

    // discontinuity handling
    #lastRead: number = NaN
    #lastStepSize: number = 0.0
    #fadeLength: number = 128
    #fading: boolean = false

    constructor(context: EngineContext, adapter: TapeDeviceBoxAdapter) {
        super(context)

        this.#adapter = adapter
        this.#audioOutput = new AudioBuffer(2)
        this.#peaks = this.own(new PeakBroadcaster(context.broadcaster, adapter.address))

        this.own(context.registerProcessor(this))
    }

    get noteEventTarget(): Option<NoteEventTarget & DeviceProcessor> {return Option.None}

    reset(): void {
        this.#peaks.clear()
        this.#audioOutput.clear()
        this.eventInput.clear()
        this.#lastRead = NaN
        this.#lastStepSize = 0.0
        this.#fading = false
    }

    get uuid(): UUID.Bytes {return this.#adapter.uuid}
    get incoming(): Processor {return this}
    get outgoing(): Processor {return this}
    get audioOutput(): AudioBuffer {return this.#audioOutput}

    process({blocks}: ProcessInfo): void {
        this.#audioOutput.clear(0, RenderQuantum)
        const [outL, outR] = this.#audioOutput.channels()
        this.#adapter.deviceHost().audioUnitBoxAdapter().tracks.collection.adapters()
            .filter(trackBoxAdapter => trackBoxAdapter.type === TrackType.Audio && trackBoxAdapter.enabled.getValue())
            .forEach(trackBoxAdapter => blocks.forEach((block) => {
                const {p0, p1, flags} = block
                if (!Bits.every(flags, BlockFlag.transporting | BlockFlag.playing)) {return}
                const intervals = this.context.clipSequencing.iterate(trackBoxAdapter.uuid, p0, p1)
                for (const {optClip, sectionFrom, sectionTo} of intervals) {
                    optClip.match({
                        none: () => {
                            for (const region of trackBoxAdapter.regions.collection.iterateRange(p0, p1)) {
                                if (region.mute || !isInstanceOf(region, AudioRegionBoxAdapter)) {continue}
                                const loader: SampleLoader = region.file.getOrCreateLoader()
                                const optData = loader.data
                                if (optData.isEmpty()) {return}
                                const data = optData.unwrap()
                                for (const cycle of LoopableRegion.locateLoops(region, p0, p1)) {
                                    this.#processPass(this.#audioOutput, data, cycle, block)
                                }
                            }
                        },
                        some: clip => {
                            if (!isInstanceOf(clip, AudioClipBoxAdapter)) {return}
                            const optData = clip.file.getOrCreateLoader().data
                            if (optData.isEmpty()) {return}
                            const data = optData.unwrap()
                            for (const cycle of LoopableRegion.locateLoops({
                                position: 0.0,
                                loopDuration: clip.duration,
                                loopOffset: 0.0,
                                complete: Number.POSITIVE_INFINITY
                            }, sectionFrom, sectionTo)) {
                                this.#processPass(this.#audioOutput, data, cycle, block)
                            }
                        }
                    })
                }
            }))
        this.#audioOutput.assertSanity()
        this.#peaks.process(outL, outR)
    }

    parameterChanged(_parameter: AutomatableParameter): void {}

    #processPass(output: AudioBuffer, data: AudioData, cycle: LoopableRegion.LoopCycle, {p0, p1, s0, s1}: Block): void {
        const [outL, outR] = output.channels()
        const {numberOfFrames, frames} = data
        const framesL = frames[0]
        const framesR = frames.length === 1 ? frames[0] : frames[1]
        const sn = s1 - s0
        const pn = p1 - p0
        const wp0 = numberOfFrames * cycle.resultStartValue
        const wp1 = numberOfFrames * cycle.resultEndValue
        const r0 = (cycle.resultStart - p0) / pn
        const r1 = (cycle.resultEnd - p0) / pn
        const bp0 = s0 + sn * r0
        const bp1 = s0 + sn * r1
        const bpn = (bp1 - bp0) | 0
        const stepSize = (wp1 - wp0) / bpn
        assert(s0 <= bp0 && bp1 <= s1, `Out of bounds ${bp0}, ${bp1}`)
        this.#fading = !Number.isFinite(this.#lastRead) || Math.abs(wp0 - (this.#lastRead + stepSize)) > 2.0
        for (let i = 0 | 0, j = bp0 | 0; i < bpn; i++, j++) {
            const readNew = wp0 + i * stepSize
            const readNewInt = readNew | 0
            let lNew = 0.0, rNew = 0.0
            if (readNewInt >= 0 && readNewInt < numberOfFrames - 1) {
                const index = readNew - readNewInt
                lNew = framesL[readNewInt] + index * (framesL[readNewInt + 1] - framesL[readNewInt])
                rNew = framesR[readNewInt] + index * (framesR[readNewInt + 1] - framesR[readNewInt])
            }
            if (this.#fading && i < this.#fadeLength && Number.isFinite(this.#lastRead)) {
                const fadeIn = i / this.#fadeLength
                const fadeOut = 1.0 - fadeIn
                const readOld = this.#lastRead + i * this.#lastStepSize
                const readOldInt = readOld | 0
                if (readOldInt >= 0 && readOldInt < numberOfFrames - 1) {
                    const aOldPos = readOld - readOldInt
                    const lOld = framesL[readOldInt] + aOldPos * (framesL[readOldInt + 1] - framesL[readOldInt])
                    const rOld = framesR[readOldInt] + aOldPos * (framesR[readOldInt + 1] - framesR[readOldInt])
                    outL[j] += fadeOut * lOld + fadeIn * lNew
                    outR[j] += fadeOut * rOld + fadeIn * rNew
                } else {
                    outL[j] += lNew
                    outR[j] += rNew
                }
            } else {
                outL[j] += lNew
                outR[j] += rNew
            }
        }
        this.#lastRead = wp0 + (bpn - 1) * stepSize
        this.#lastStepSize = stepSize
    }
}