import {int, Option, Terminable, UUID} from "@opendaw/lib-std"
import {AudioBuffer, Event, PPQN} from "@opendaw/lib-dsp"
import {MIDIOutputDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {EngineContext} from "../../EngineContext"
import {AudioProcessor} from "../../AudioProcessor"
import {Block, Processor} from "../../processing"
import {AutomatableParameter} from "../../AutomatableParameter"
import {NoteEventSource, NoteEventTarget, NoteLifecycleEvent} from "../../NoteEventSource"
import {DeviceProcessor} from "../../DeviceProcessor"
import {InstrumentDeviceProcessor} from "../../InstrumentDeviceProcessor"
import {MidiData} from "@opendaw/lib-midi"

export class MIDIOutputDeviceProcessor extends AudioProcessor implements InstrumentDeviceProcessor, NoteEventTarget {
    readonly #adapter: MIDIOutputDeviceBoxAdapter

    readonly #audioOutput: AudioBuffer
    readonly #data: Int32Array

    #index: int = 0

    #source: Option<NoteEventSource> = Option.None

    constructor(context: EngineContext, adapter: MIDIOutputDeviceBoxAdapter) {
        super(context)

        this.#adapter = adapter
        this.#audioOutput = new AudioBuffer()
        this.#data = new Int32Array(1024) // TODO How large should this be?

        this.ownAll(
            context.liveStreamBroadcaster.broadcastIntegers(adapter.address, this.#data, () => {
                this.#data[this.#index] = -1
                this.#index = 0
            }),
            context.registerProcessor(this)
        )
        this.readAllParameters()
    }

    get noteEventTarget(): Option<NoteEventTarget & DeviceProcessor> {return Option.wrap(this)}

    introduceBlock({p0, p1, s0, flags, bpm}: Block): void {
        if (this.#source.isEmpty()) {return}
        for (const event of this.#source.unwrap().processNotes(p0, p1, flags)) {
            if (event.pitch >= 0 && event.pitch <= 127) {
                const relativeTimeInMs = (s0 / sampleRate + PPQN.pulsesToSeconds(event.position - p0, bpm)) * 1000.0
                if (NoteLifecycleEvent.isStart(event)) {
                    this.context.engineToClient
                        .sendMIDIData(this.#adapter.uuid,
                            MidiData.noteOn(1, event.pitch, Math.round(event.velocity * 127)), relativeTimeInMs)
                } else if (NoteLifecycleEvent.isStop(event)) {
                    this.context.engineToClient
                        .sendMIDIData(this.#adapter.uuid,
                            MidiData.noteOff(1, event.pitch), relativeTimeInMs)
                }
            }
        }
    }

    setNoteEventSource(source: NoteEventSource): Terminable {
        this.#source = Option.wrap(source)
        return Terminable.create(() => this.#source = Option.None)
    }

    get incoming(): Processor {return this}
    get outgoing(): Processor {return this}

    reset(): void {}

    get uuid(): UUID.Bytes {return this.#adapter.uuid}
    get audioOutput(): AudioBuffer {return this.#audioOutput}
    get adapter(): MIDIOutputDeviceBoxAdapter {return this.#adapter}

    handleEvent(_event: Event): void {}
    processAudio(_block: Block, _fromIndex: int, _toIndex: int): void {}
    parameterChanged(_parameter: AutomatableParameter): void {}
    finishProcess(): void {}

    toString(): string {return `{MIDIOutputDeviceProcessor}`}
}