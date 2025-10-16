import {AudioEffectDeviceAdapter, CompressorDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {int, Option, Terminable, UUID} from "@opendaw/lib-std"
import {AudioBuffer, Event, gainToDb, RenderQuantum} from "@opendaw/lib-dsp"
import {EngineContext} from "../../EngineContext"
import {Block, Processor} from "../../processing"
import {PeakBroadcaster} from "../../PeakBroadcaster"
import {AudioProcessor} from "../../AudioProcessor"
import {AutomatableParameter} from "../../AutomatableParameter"
import {AudioEffectDeviceProcessor} from "../../AudioEffectDeviceProcessor"
import {
    decibelsToGain,
    DelayLine,
    GainComputer,
    LevelDetector,
    LookAhead,
    SmoothingFilter
} from "@opendaw/lib-dsp/ctagdrc"

/**
 * Ported from https://github.com/p-hlp/CTAGDRC
 * More information in the ./ctagdrc/readme.md file
 */
export class CompressorDeviceProcessor extends AudioProcessor implements AudioEffectDeviceProcessor {
    static readonly PEAK_DECAY_PER_SAMPLE = Math.exp(-1.0 / (sampleRate * 0.500))
    static readonly REDUCTION_DECAY_PER_SAMPLE = RenderQuantum / sampleRate * 0.050

    static ID: int = 0 | 0

    readonly #id: int = CompressorDeviceProcessor.ID++
    readonly #adapter: CompressorDeviceBoxAdapter

    readonly parameterLookahead: AutomatableParameter<boolean>
    readonly parameterAutomakeup: AutomatableParameter<boolean>
    readonly parameterAutoattack: AutomatableParameter<boolean>
    readonly parameterAutorelease: AutomatableParameter<boolean>
    readonly parameterInputgain: AutomatableParameter<number>
    readonly parameterThreshold: AutomatableParameter<number>
    readonly parameterRatio: AutomatableParameter<number>
    readonly parameterKnee: AutomatableParameter<number>
    readonly parameterAttack: AutomatableParameter<number>
    readonly parameterRelease: AutomatableParameter<number>
    readonly parameterMakeup: AutomatableParameter<number>
    readonly parameterMix: AutomatableParameter<number>

    readonly #output: AudioBuffer
    readonly #peaks: PeakBroadcaster

    #source: Option<AudioBuffer> = Option.None

    #lookahead: boolean = false
    #automakeup: boolean = false
    #autoattack: boolean = false
    #autorelease: boolean = false
    #inputgain: number = 0.0
    #threshold: number = -10.0
    #ratio: number = 2.0
    #knee: number = 6.0
    #attack: number = 2.0
    #release: number = 140.0
    #makeup: number = 0.0
    #mix: number = 1.0

    // DSP components
    readonly #ballistics: LevelDetector
    readonly #gainComputer: GainComputer = new GainComputer()
    readonly #delay: DelayLine
    readonly #lookaheadProcessor: LookAhead
    readonly #smoothedAutoMakeup: SmoothingFilter

    // State variables
    readonly #sidechainSignal: Float32Array
    readonly #originalSignal: readonly [Float32Array, Float32Array]
    readonly #lookaheadDelay: number = 0.005
    readonly #editorValues: Float32Array

    #prevInput: number = 0.0
    #autoMakeup: number = 0.0

    #inpMax: number = 0.0
    #outMax: number = 0.0
    #redMin: number = 0.0

    constructor(context: EngineContext, adapter: CompressorDeviceBoxAdapter) {
        super(context)

        this.#adapter = adapter
        this.#output = new AudioBuffer()
        this.#peaks = this.own(new PeakBroadcaster(context.broadcaster, adapter.address))
        this.#editorValues = new Float32Array([Number.NEGATIVE_INFINITY, 0.0, Number.NEGATIVE_INFINITY])

        const {
            lookahead, automakeup, autoattack, autorelease,
            inputgain, threshold, ratio, knee, attack, release, makeup, mix
        } = adapter.namedParameter

        this.parameterLookahead = this.own(this.bindParameter(lookahead))
        this.parameterAutomakeup = this.own(this.bindParameter(automakeup))
        this.parameterAutoattack = this.own(this.bindParameter(autoattack))
        this.parameterAutorelease = this.own(this.bindParameter(autorelease))
        this.parameterInputgain = this.own(this.bindParameter(inputgain))
        this.parameterThreshold = this.own(this.bindParameter(threshold))
        this.parameterRatio = this.own(this.bindParameter(ratio))
        this.parameterKnee = this.own(this.bindParameter(knee))
        this.parameterAttack = this.own(this.bindParameter(attack))
        this.parameterRelease = this.own(this.bindParameter(release))
        this.parameterMakeup = this.own(this.bindParameter(makeup))
        this.parameterMix = this.own(this.bindParameter(mix))

        this.#ballistics = new LevelDetector(sampleRate)
        this.#delay = new DelayLine(sampleRate, 0.005, RenderQuantum, 2)
        this.#lookaheadProcessor = new LookAhead(sampleRate, this.#lookaheadDelay, RenderQuantum)
        this.#smoothedAutoMakeup = new SmoothingFilter(sampleRate)
        this.#smoothedAutoMakeup.setAlpha(0.03)

        this.#sidechainSignal = new Float32Array(RenderQuantum)
        this.#originalSignal = [
            new Float32Array(RenderQuantum),
            new Float32Array(RenderQuantum)
        ]

        this.ownAll(
            context.registerProcessor(this),
            context.broadcaster.broadcastFloats(adapter.address.append(0),
                this.#editorValues, () => {
                    this.#editorValues[0] = gainToDb(this.#inpMax)
                    this.#editorValues[1] = this.#redMin
                    this.#editorValues[2] = gainToDb(this.#outMax)
                })
        )
        this.readAllParameters()
    }

    get incoming(): Processor {return this}
    get outgoing(): Processor {return this}

    reset(): void {
        this.#output.clear()
        this.#peaks.clear()
        this.eventInput.clear()
        this.#sidechainSignal.fill(0)
        this.#originalSignal[0].fill(0)
        this.#originalSignal[1].fill(0)
        this.#prevInput = this.#inputgain
        this.#autoMakeup = 0.0
        this.#inpMax = 0.0
        this.#outMax = 0.0
        this.#redMin = 0.0
    }

    get uuid(): UUID.Bytes {return this.#adapter.uuid}
    get audioOutput(): AudioBuffer {return this.#output}

    setAudioSource(source: AudioBuffer): Terminable {
        this.#source = Option.wrap(source)
        return {terminate: () => this.#source = Option.None}
    }

    index(): int {return this.#adapter.indexField.getValue()}
    adapter(): AudioEffectDeviceAdapter {return this.#adapter}

    handleEvent(_event: Event): void {}

    processAudio(_block: Block, from: int, to: int): void {
        if (this.#source.isEmpty()) return
        const source = this.#source.unwrap()

        const numSamples = to - from
        const srcL = source.getChannel(0)
        const srcR = source.getChannel(1)
        const outL = this.#output.getChannel(0)
        const outR = this.#output.getChannel(1)

        for (let i = from; i < to; i++) {
            const l = srcL[i]
            const r = srcR[i]
            outL[i] = l
            outR[i] = r
            const peak = Math.max(Math.abs(l), Math.abs(r))
            if (this.#inpMax <= peak) {this.#inpMax = peak} else {this.#inpMax *= CompressorDeviceProcessor.PEAK_DECAY_PER_SAMPLE}
        }

        // Clear sidechain and original signal buffers
        this.#sidechainSignal.fill(0, 0, numSamples)

        // Apply input gain
        this.#applyInputGain(outL, outR, from, numSamples)

        // Get max L/R amplitude values and fill sidechain signal
        for (let i = 0; i < numSamples; i++) {
            const idx = from + i
            this.#sidechainSignal[i] = Math.max(Math.abs(outL[idx]), Math.abs(outR[idx]))
        }

        // Calculate crest factor on max amplitude values
        this.#ballistics.processCrestFactor(this.#sidechainSignal, numSamples)

        // Compute attenuation - converts sidechain from linear to logarithmic
        this.#gainComputer.applyCompressionToBuffer(this.#sidechainSignal, numSamples)

        // Smooth attenuation - still logarithmic
        this.#ballistics.applyBallistics(this.#sidechainSignal, numSamples)

        // Get minimum = max gain reduction from a sidechain signal
        for (let i = 0; i < numSamples; i++) {
            const peak = this.#sidechainSignal[i]
            if (this.#redMin >= peak) {
                this.#redMin = peak
            } else {
                this.#redMin += CompressorDeviceProcessor.REDUCTION_DECAY_PER_SAMPLE
            }
        }

        // Calculate auto makeup
        this.#autoMakeup = this.#calculateAutoMakeup(this.#sidechainSignal, numSamples)

        // Do lookahead if enabled
        if (this.#lookahead) {
            // Delay input buffer
            this.#delay.process(this.#output, numSamples)

            // Process sidechain (delay + gain reduction fade in)
            this.#lookaheadProcessor.process(this.#sidechainSignal, numSamples)
        }

        // Add makeup gain and convert sidechain to a linear domain
        for (let i = 0; i < numSamples; i++) {
            this.#sidechainSignal[i] = decibelsToGain(
                this.#sidechainSignal[i] + this.#makeup + this.#autoMakeup
            )
        }

        // Copy buffer to the original signal for dry/wet mixing
        for (let i = 0; i < numSamples; i++) {
            const idx = from + i
            this.#originalSignal[0][i] = outL[idx]
            this.#originalSignal[1][i] = outR[idx]
        }

        // Multiply attenuation with buffer - apply compression
        for (let i = 0; i < numSamples; i++) {
            const idx = from + i
            outL[idx] *= this.#sidechainSignal[i]
            outR[idx] *= this.#sidechainSignal[i]
        }

        // Mix dry and wet signal
        for (let i = 0; i < numSamples; i++) {
            const idx = from + i
            const l = outL[idx] * this.#mix + this.#originalSignal[0][i] * (1.0 - this.#mix)
            const r = outR[idx] * this.#mix + this.#originalSignal[1][i] * (1.0 - this.#mix)
            const peak = Math.max(Math.abs(l), Math.abs(r))
            if (this.#outMax <= peak) {this.#outMax = peak} else {this.#outMax *= CompressorDeviceProcessor.PEAK_DECAY_PER_SAMPLE}
            outL[idx] = l
            outR[idx] = r
        }

        this.#peaks.process(outL, outR, from, to)
    }

    #applyInputGain(left: Float32Array, right: Float32Array, offset: int, numSamples: int): void {
        const startGain = decibelsToGain(this.#prevInput)
        const endGain = decibelsToGain(this.#inputgain)

        if (Math.abs(startGain - endGain) < 0.0001) {
            // No ramp needed
            for (let i = 0; i < numSamples; i++) {
                const idx = offset + i
                left[idx] *= endGain
                right[idx] *= endGain
            }
        } else {
            // Apply gain ramp
            for (let i = 0; i < numSamples; i++) {
                const idx = offset + i
                const t = i / numSamples
                const gain = startGain + (endGain - startGain) * t
                left[idx] *= gain
                right[idx] *= gain
            }
            this.#prevInput = this.#inputgain
        }
    }

    #calculateAutoMakeup(src: Float32Array, numSamples: int): number {
        let sum = 0.0
        for (let i = 0; i < numSamples; i++) {
            sum += src[i]
        }
        this.#smoothedAutoMakeup.process(-sum / numSamples)
        return this.#automakeup ? this.#smoothedAutoMakeup.getState() : 0.0
    }

    parameterChanged(parameter: AutomatableParameter): void {
        if (parameter === this.parameterLookahead) {
            this.#lookahead = this.parameterLookahead.getValue()
        } else if (parameter === this.parameterAutomakeup) {
            this.#automakeup = this.parameterAutomakeup.getValue()
        } else if (parameter === this.parameterAutoattack) {
            this.#autoattack = this.parameterAutoattack.getValue()
            this.#ballistics.setAutoAttack(this.#autoattack)
            if (!this.#autoattack) {
                this.#ballistics.setAttack(this.#attack * 0.001) // Convert ms to seconds
            }
        } else if (parameter === this.parameterAutorelease) {
            this.#autorelease = this.parameterAutorelease.getValue()
            this.#ballistics.setAutoRelease(this.#autorelease)
            if (!this.#autorelease) {
                this.#ballistics.setRelease(this.#release * 0.001) // Convert ms to seconds
            }
        } else if (parameter === this.parameterInputgain) {
            this.#inputgain = this.parameterInputgain.getValue()
        } else if (parameter === this.parameterThreshold) {
            this.#threshold = this.parameterThreshold.getValue()
            this.#gainComputer.setThreshold(this.#threshold)
        } else if (parameter === this.parameterRatio) {
            this.#ratio = this.parameterRatio.getValue()
            this.#gainComputer.setRatio(this.#ratio)
        } else if (parameter === this.parameterKnee) {
            this.#knee = this.parameterKnee.getValue()
            this.#gainComputer.setKnee(this.#knee)
        } else if (parameter === this.parameterAttack) {
            this.#attack = this.parameterAttack.getValue()
            if (!this.#autoattack) {
                this.#ballistics.setAttack(this.#attack * 0.001) // Convert ms to seconds
            }
        } else if (parameter === this.parameterRelease) {
            this.#release = this.parameterRelease.getValue()
            if (!this.#autorelease) {
                this.#ballistics.setRelease(this.#release * 0.001) // Convert ms to seconds
            }
        } else if (parameter === this.parameterMakeup) {
            this.#makeup = this.parameterMakeup.getValue()
        } else if (parameter === this.parameterMix) {
            this.#mix = this.parameterMix.getValue()
        }
    }

    toString(): string {return `{${this.constructor.name} (${this.#id})}`}
}