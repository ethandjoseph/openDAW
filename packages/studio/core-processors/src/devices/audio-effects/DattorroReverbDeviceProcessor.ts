import {AudioEffectDeviceAdapter, DattorroReverbDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {int, Option, Terminable, UUID} from "@opendaw/lib-std"
import {AudioBuffer, Event, StereoMatrix} from "@opendaw/lib-dsp"
import {EngineContext} from "../../EngineContext"
import {Block, Processor} from "../../processing"
import {PeakBroadcaster} from "../../PeakBroadcaster"
import {AudioProcessor} from "../../AudioProcessor"
import {AutomatableParameter} from "../../AutomatableParameter"
import {AudioEffectDeviceProcessor} from "../../AudioEffectDeviceProcessor"
import {DattorroReverbDsp} from "./DattorroReverbDsp"

export class DattorroReverbDeviceProcessor extends AudioProcessor implements AudioEffectDeviceProcessor {
    static ID: int = 0 | 0

    readonly #id: int = DattorroReverbDeviceProcessor.ID++

    readonly #adapter: DattorroReverbDeviceBoxAdapter

    readonly parameterPredelay: AutomatableParameter<number>

    readonly #dsp: DattorroReverbDsp

    readonly #output: AudioBuffer
    readonly #peaks: PeakBroadcaster

    #source: Option<AudioBuffer> = Option.None

    constructor(context: EngineContext, adapter: DattorroReverbDeviceBoxAdapter) {
        super(context)

        this.#adapter = adapter
        this.#output = new AudioBuffer()
        this.#peaks = this.own(new PeakBroadcaster(context.broadcaster, adapter.address))
        this.#dsp = new DattorroReverbDsp(sampleRate)

        const {preDelay} = adapter.namedParameter
        this.parameterPredelay = this.own(this.bindParameter(preDelay))

        this.own(context.registerProcessor(this))
        this.readAllParameters()
    }

    get incoming(): Processor {return this}
    get outgoing(): Processor {return this}

    reset(): void {
        this.#dsp.reset()
        this.#output.clear()
        this.#peaks.clear()
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

    handleEvent(_event: Event): void {}

    processAudio({bpm, flags}: Block, from: number, to: number): void {
        if (this.#source.isEmpty()) {return}
        const source = this.#source.unwrap()
        this.#dsp.process(source.channels() as StereoMatrix.Channels, this.#output.channels() as StereoMatrix.Channels, from, to)
        this.#peaks.process(this.#output.getChannel(0), this.#output.getChannel(1), from, to)
    }

    parameterChanged(parameter: AutomatableParameter): void {
        if (parameter === this.parameterPredelay) {
            // TODO
        }
    }

    toString(): string {return `{${this.constructor.name} (${this.#id})}`}
}