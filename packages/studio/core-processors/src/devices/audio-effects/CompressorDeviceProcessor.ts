import {AudioEffectDeviceAdapter, CompressorDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {int, Option, Terminable, UUID} from "@opendaw/lib-std"
import {Event} from "@opendaw/lib-dsp"
import {EngineContext} from "../../EngineContext"
import {Block, Processor} from "../../processing"
import {AudioBuffer} from "../../AudioBuffer"
import {PeakBroadcaster} from "../../PeakBroadcaster"
import {AudioProcessor} from "../../AudioProcessor"
import {AutomatableParameter} from "../../AutomatableParameter"
import {AudioEffectDeviceProcessor} from "../../AudioEffectDeviceProcessor"
import {LevelDetector} from "./compressor/LevelDetector"
import {GainComputer} from "./compressor/GainComputer"
import {DelayLine} from "./compressor/DelayLine"
import {LookAhead} from "./compressor/LookAhead"
import {SmoothingFilter} from "./compressor/SmoothingFilter"
import {RenderQuantum} from "../../constants"
import {decibelsToGain} from "./compressor/conversation"

export class CompressorDeviceProcessor extends AudioProcessor implements AudioEffectDeviceProcessor {
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
    readonly #sampleRate: number
    readonly #maxBlockSize: int
    readonly #sidechainSignal: Float32Array
    readonly #originalSignal: readonly [Float32Array, Float32Array]
    readonly #lookaheadDelay: number = 0.005

    #prevInput: number = 0.0
    #autoMakeup: number = 0.0
    #maxGainReduction: number = 0.0

    constructor(context: EngineContext, adapter: CompressorDeviceBoxAdapter) {
        super(context)

        this.#adapter = adapter
        this.#output = new AudioBuffer()
        this.#peaks = this.own(new PeakBroadcaster(context.broadcaster, adapter.address))

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

        // TODO replace
        this.#sampleRate = sampleRate
        this.#maxBlockSize = RenderQuantum

        this.#ballistics = new LevelDetector(this.#sampleRate)
        this.#delay = new DelayLine(this.#sampleRate, 0.005, this.#maxBlockSize, 2)
        this.#lookaheadProcessor = new LookAhead(this.#sampleRate, this.#lookaheadDelay, this.#maxBlockSize)
        this.#smoothedAutoMakeup = new SmoothingFilter(this.#sampleRate)
        this.#smoothedAutoMakeup.setAlpha(0.03)

        this.#sidechainSignal = new Float32Array(this.#maxBlockSize)
        this.#originalSignal = [
            new Float32Array(this.#maxBlockSize),
            new Float32Array(this.#maxBlockSize)
        ]

        this.ownAll(
            context.registerProcessor(this),
            context.broadcaster.broadcastFloat(adapter.address.append(0), () => this.#maxGainReduction)
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
        this.#maxGainReduction = 0.0
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
        const leftChannel = this.#output.getChannel(0)
        const rightChannel = this.#output.getChannel(1)
        const srcLeft = source.getChannel(0)
        const srcRight = source.getChannel(1)

        // Copy input to output
        for (let i = from; i < to; i++) {
            leftChannel[i] = srcLeft[i]
            rightChannel[i] = srcRight[i]
        }

        // Clear sidechain and original signal buffers
        this.#sidechainSignal.fill(0, 0, numSamples)
        this.#maxGainReduction = 0.0

        // Apply input gain
        this.#applyInputGain(leftChannel, rightChannel, from, numSamples)

        // Get max L/R amplitude values and fill sidechain signal
        for (let i = 0; i < numSamples; i++) {
            const idx = from + i
            this.#sidechainSignal[i] = Math.max(
                Math.abs(leftChannel[idx]),
                Math.abs(rightChannel[idx])
            )
        }

        // Calculate crest factor on max amplitude values
        this.#ballistics.processCrestFactor(this.#sidechainSignal, numSamples)

        // Compute attenuation - converts sidechain from linear to logarithmic
        this.#gainComputer.applyCompressionToBuffer(this.#sidechainSignal, numSamples)

        // Smooth attenuation - still logarithmic
        this.#ballistics.applyBallistics(this.#sidechainSignal, numSamples)

        // Get minimum = max gain reduction from a sidechain signal
        let minValue = this.#sidechainSignal[0]
        for (let i = 1; i < numSamples; i++) {
            minValue = Math.min(minValue, this.#sidechainSignal[i])
        }
        this.#maxGainReduction = minValue

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
            this.#originalSignal[0][i] = leftChannel[idx]
            this.#originalSignal[1][i] = rightChannel[idx]
        }

        // Multiply attenuation with buffer - apply compression
        for (let i = 0; i < numSamples; i++) {
            const idx = from + i
            leftChannel[idx] *= this.#sidechainSignal[i]
            rightChannel[idx] *= this.#sidechainSignal[i]
        }

        // Mix dry & wet signal
        for (let i = 0; i < numSamples; i++) {
            const idx = from + i
            leftChannel[idx] = leftChannel[idx] * this.#mix + this.#originalSignal[0][i] * (1 - this.#mix)
            rightChannel[idx] = rightChannel[idx] * this.#mix + this.#originalSignal[1][i] * (1 - this.#mix)
        }

        this.#peaks.process(leftChannel, rightChannel, from, to)
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