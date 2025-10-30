import {BlockFlag, ProcessInfo} from "./processing"
import {Fragmentor, PPQN} from "@opendaw/lib-dsp"
import {EngineContext} from "./EngineContext"
import {Bits, int} from "@opendaw/lib-std"
import {AbstractProcessor} from "./AbstractProcessor"
import {RootBoxAdapter} from "@opendaw/studio-adapters"
import {MidiData} from "@opendaw/lib-midi"

export class MIDITransportSender extends AbstractProcessor {
    static readonly ClockRate = PPQN.fromSignature(1, 24 * 4) // 24 pulses per quarter note

    readonly #adapter: RootBoxAdapter
    readonly #midiTransportMessages: Array<Uint8Array>

    constructor(context: EngineContext, adapter: RootBoxAdapter) {
        super(context)

        this.#adapter = adapter
        this.#midiTransportMessages = []

        this.own(this.context.registerProcessor(this))
    }

    schedule(message: Uint8Array): void {
        this.#midiTransportMessages.push(message)
    }

    reset(): void {this.eventInput.clear()}

    process({blocks}: ProcessInfo): void {
        const midiOutputBoxes = this.#adapter.midiOutputDevices
        if (midiOutputBoxes.length === 0) {
            this.#midiTransportMessages.length = 0
            return
        }
        const filteredBoxes = midiOutputBoxes
            .filter(box => box.sendTransportMessages.getValue() && box.id.getValue() !== "")
        if (filteredBoxes.length === 0) {
            this.#midiTransportMessages.length = 0
            return
        }
        blocks.forEach(({p0, p1, s0, bpm, flags}, index: int) => {
            const blockOffsetInSeconds = s0 / sampleRate
            if (index === 0) {
                filteredBoxes.forEach(box => {
                    const id = box.id.getValue()
                    const delayInMs = box.delayInMs.getValue()
                    const relativeTimeInMs = blockOffsetInSeconds * 1000.0 + delayInMs
                    this.#midiTransportMessages.forEach(message =>
                        this.context.engineToClient.sendMIDIData(id, message, relativeTimeInMs))
                })
            }
            if (!Bits.every(flags, BlockFlag.transporting)) {return}
            for (const position of Fragmentor.iterate(p0, p1, MIDITransportSender.ClockRate)) {
                const eventOffsetInSeconds = PPQN.pulsesToSeconds(position - p0, bpm)
                filteredBoxes.forEach(box => {
                    const id = box.id.getValue()
                    const delayInMs = box.delayInMs.getValue()
                    const relativeTimeInMs = (blockOffsetInSeconds + eventOffsetInSeconds) * 1000.0 + delayInMs
                    this.context.engineToClient.sendMIDIData(id, MidiData.Clock, relativeTimeInMs)
                })
            }
        })
        this.#midiTransportMessages.length = 0
    }

    toString(): string {return `{${this.constructor.name}}`}
}