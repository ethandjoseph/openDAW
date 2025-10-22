import {int, Option, Terminable, UUID} from "@opendaw/lib-std"
import {AudioEffectDeviceAdapter, FoldDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {EngineContext} from "../../EngineContext"
import {Block, Processor} from "../../processing"
import {PeakBroadcaster} from "../../PeakBroadcaster"
import {AutomatableParameter} from "../../AutomatableParameter"
import {AudioEffectDeviceProcessor} from "../../AudioEffectDeviceProcessor"
import {AudioBuffer, Ramp, RenderQuantum, ResamplerStereo, StereoMatrix} from "@opendaw/lib-dsp"
import {AudioProcessor} from "../../AudioProcessor"

const oversampleFactor = 8

const wavefold = (x: number, t: number): number => {
    const scaled = 0.25 * t * x + 0.25
    return 4.0 * (Math.abs(scaled - Math.round(scaled)) - 0.25)
}

export class FoldDeviceProcessor extends AudioProcessor implements AudioEffectDeviceProcessor {
    static ID: int = 0 | 0

    readonly #id: int = FoldDeviceProcessor.ID++

    readonly #adapter: FoldDeviceBoxAdapter
    readonly #output: AudioBuffer
    readonly #buffer: StereoMatrix.Channels
    readonly #peaks: PeakBroadcaster
    readonly #smoothAmount: Ramp<number>
    readonly #resampler: ResamplerStereo

    readonly parameterAmount: AutomatableParameter<number>

    #source: Option<AudioBuffer> = Option.None
    #processed: boolean = false

    constructor(context: EngineContext, adapter: FoldDeviceBoxAdapter) {
        super(context)

        this.#adapter = adapter
        this.#output = new AudioBuffer()
        this.#buffer = [
            new Float32Array(RenderQuantum * oversampleFactor),
            new Float32Array(RenderQuantum * oversampleFactor)]
        this.#peaks = this.own(new PeakBroadcaster(context.broadcaster, adapter.address))
        this.#smoothAmount = Ramp.linear(sampleRate)
        this.#resampler = new ResamplerStereo(oversampleFactor)

        const {amount} = adapter.namedParameter
        this.parameterAmount = this.own(this.bindParameter(amount))

        this.own(context.registerProcessor(this))
        this.readAllParameters()
    }

    get incoming(): Processor {return this}
    get outgoing(): Processor {return this}

    reset(): void {
        this.#processed = false
        this.#peaks.clear()
        this.#output.clear()
        this.eventInput.clear()
    }

    get uuid(): UUID.Bytes {return this.#adapter.uuid}

    get audioOutput(): AudioBuffer {return this.#output}

    setAudioSource(source: AudioBuffer): Terminable {
        this.#source = Option.wrap(source)
        return {terminate: () => this.#source = Option.None}
    }

    index(): int {return this.#adapter.indexField.getValue()}

    adapter(): AudioEffectDeviceAdapter {return this.#adapter}

    processAudio(_block: Block, fromIndex: int, toIndex: int): void {
        if (this.#source.isEmpty()) {return}
        const input = this.#source.unwrap()

        this.#peaks.process(
            this.#output.getChannel(0),
            this.#output.getChannel(1),
            fromIndex, toIndex)

        this.#resampler.upsample(input.channels() as StereoMatrix.Channels, this.#buffer, fromIndex, toIndex)

        const oversampledLength = (toIndex - fromIndex) * 8
        const [oversampledL, oversampledR] = this.#buffer
        for (let i = 0; i < oversampledLength; i++) {
            const amount = this.#smoothAmount.moveAndGet()
            oversampledL[i] = wavefold(oversampledL[i], amount)
            oversampledR[i] = wavefold(oversampledR[i], amount)
        }

        this.#resampler.downsample(this.#buffer, this.#output.channels() as StereoMatrix.Channels, fromIndex, toIndex)
        this.#processed = true
    }

    parameterChanged(parameter: AutomatableParameter): void {
        if (parameter === this.parameterAmount) {
            this.#smoothAmount.set(this.parameterAmount.getValue(), this.#processed)
        }
    }

    toString(): string {return `{${this.constructor.name} (${this.#id})`}
}