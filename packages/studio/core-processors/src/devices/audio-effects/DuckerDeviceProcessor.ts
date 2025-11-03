import {int, Option, Terminable, UUID} from "@opendaw/lib-std"
import {DuckerDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {EngineContext} from "../../EngineContext"
import {Block, Processor} from "../../processing"
import {PeakBroadcaster} from "../../PeakBroadcaster"
import {AutomatableParameter} from "../../AutomatableParameter"
import {AudioEffectDeviceProcessor} from "../../AudioEffectDeviceProcessor"
import {AudioBuffer, DuckerComputer, PPQN, Smooth} from "@opendaw/lib-dsp"
import {AudioProcessor} from "../../AudioProcessor"

export class DuckerDeviceProcessor extends AudioProcessor implements AudioEffectDeviceProcessor {
    static ID: int = 0 | 0

    readonly #id: int = DuckerDeviceProcessor.ID++

    readonly #adapter: DuckerDeviceBoxAdapter
    readonly #output: AudioBuffer
    readonly #peaks: PeakBroadcaster
    readonly #computer: DuckerComputer
    readonly #smoothGainL: Smooth
    readonly #smoothGainR: Smooth

    readonly #pDepth: AutomatableParameter<number>
    readonly #pSlope: AutomatableParameter<number>
    readonly #pSymmetry: AutomatableParameter<number>
    readonly #pOffset: AutomatableParameter<number>
    readonly #pChannelOffset: AutomatableParameter<number>

    #source: Option<AudioBuffer> = Option.None

    #needsUpdate: boolean = true

    constructor(context: EngineContext, adapter: DuckerDeviceBoxAdapter) {
        super(context)

        this.#adapter = adapter
        this.#output = new AudioBuffer()
        this.#peaks = this.own(new PeakBroadcaster(context.broadcaster, adapter.address))
        this.#computer = new DuckerComputer()
        this.#smoothGainL = new Smooth(0.003, sampleRate)
        this.#smoothGainR = new Smooth(0.003, sampleRate)

        const {depth, slope, symmetry, offset, channelOffset} = adapter.namedParameter

        this.#pDepth = this.bindParameter(depth)
        this.#pSlope = this.bindParameter(slope)
        this.#pSymmetry = this.bindParameter(symmetry)
        this.#pOffset = this.bindParameter(offset)
        this.#pChannelOffset = this.bindParameter(channelOffset)

        this.own(context.registerProcessor(this))
        this.readAllParameters()
    }

    get incoming(): Processor {return this}
    get outgoing(): Processor {return this}

    reset(): void {
        this.#needsUpdate = true
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
    adapter(): DuckerDeviceBoxAdapter {return this.#adapter}

    processAudio({p0, s0, bpm}: Block, fromIndex: int, toIndex: int): void {
        if (this.#source.isEmpty()) {return}
        const input = this.#source.unwrap()
        const [inpL, inpR] = input.channels()
        const [outL, outR] = this.#output.channels()

        if (this.#needsUpdate) {
            this.#computer.set(this.#pDepth.getValue(), this.#pSlope.getValue(), this.#pSymmetry.getValue())
            this.#needsUpdate = false
        }

        const delta = PPQN.samplesToPulses(1, bpm, sampleRate)

        const offset = this.#pOffset.getValue()
        const channelOffset = this.#pChannelOffset.getValue()

        for (let i = fromIndex; i < toIndex; i++) {
            const pL = (p0 + offset + i * delta) / PPQN.Quarter
            const gL = this.#computer.compute(pL - Math.floor(pL))
            const pR = (p0 + offset + channelOffset + i * delta) / PPQN.Quarter
            const gR = this.#computer.compute(pR - Math.floor(pR))
            outL[i] = inpL[i] * this.#smoothGainL.process(gL)
            outR[i] = inpR[i] * this.#smoothGainR.process(gR)
        }
        this.#peaks.process(outL, outR)
    }

    parameterChanged(parameter: AutomatableParameter): void {
        if (parameter === this.#pDepth || parameter === this.#pSlope || parameter === this.#pSymmetry) {
            this.#needsUpdate = true
        }
    }

    toString(): string {return `{${this.constructor.name} (${this.#id})`}
}