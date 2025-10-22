import {int, Option, Terminable, UUID} from "@opendaw/lib-std"
import {AudioEffectDeviceAdapter, FoldDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {EngineContext} from "../../EngineContext"
import {Block, Processor} from "../../processing"
import {PeakBroadcaster} from "../../PeakBroadcaster"
import {AutomatableParameter} from "../../AutomatableParameter"
import {AudioEffectDeviceProcessor} from "../../AudioEffectDeviceProcessor"
import {AudioBuffer, dbToGain, Ramp, RenderQuantum, ResamplerStereo, StereoMatrix, wavefold} from "@opendaw/lib-dsp"
import {AudioProcessor} from "../../AudioProcessor"

const maxOversampleFactor = 8

export class FoldDeviceProcessor extends AudioProcessor implements AudioEffectDeviceProcessor {
    static ID: int = 0 | 0

    readonly #id: int = FoldDeviceProcessor.ID++

    readonly #adapter: FoldDeviceBoxAdapter
    readonly #output: AudioBuffer
    readonly #buffer: StereoMatrix.Channels
    readonly #peaks: PeakBroadcaster
    readonly #smoothGain: Ramp<number>
    readonly #resampler: ResamplerStereo

    readonly parameterDrive: AutomatableParameter<number>

    #source: Option<AudioBuffer> = Option.None
    #processed: boolean = false

    constructor(context: EngineContext, adapter: FoldDeviceBoxAdapter) {
        super(context)

        this.#adapter = adapter
        this.#output = new AudioBuffer()
        this.#buffer = [
            new Float32Array(RenderQuantum * maxOversampleFactor),
            new Float32Array(RenderQuantum * maxOversampleFactor)]
        this.#peaks = this.own(new PeakBroadcaster(context.broadcaster, adapter.address))
        this.#smoothGain = Ramp.linear(sampleRate)
        this.#resampler = new ResamplerStereo()

        const {drive} = adapter.namedParameter
        this.parameterDrive = this.own(this.bindParameter(drive))

        const oversamplingValues = [2, 4, 8] as const
        this.ownAll(
            context.registerProcessor(this),
            adapter.box.overSampling.catchupAndSubscribe(owner =>
                this.#resampler.setFactor(oversamplingValues[owner.getValue()]))
        )
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
            const amount = this.#smoothGain.moveAndGet()
            oversampledL[i] = wavefold(oversampledL[i], amount)
            oversampledR[i] = wavefold(oversampledR[i], amount)
        }

        this.#resampler.downsample(this.#buffer, this.#output.channels() as StereoMatrix.Channels, fromIndex, toIndex)
        this.#processed = true
    }

    parameterChanged(parameter: AutomatableParameter): void {
        if (parameter === this.parameterDrive) {
            this.#smoothGain.set(dbToGain(this.parameterDrive.getValue()), this.#processed)
        }
    }

    toString(): string {return `{${this.constructor.name} (${this.#id})`}
}