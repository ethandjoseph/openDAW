import {Arrays, asInstanceOf, byte, int, Option, Terminable, UUID} from "@opendaw/lib-std"
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
import {MIDIOutputParameterBox} from "@opendaw/studio-boxes"

export class MIDIOutputDeviceProcessor extends AudioProcessor implements InstrumentDeviceProcessor, NoteEventTarget {
    readonly #adapter: MIDIOutputDeviceBoxAdapter

    readonly #audioOutput: AudioBuffer

    readonly #activeNotes: Array<byte> = []

    readonly #parameters: Array<AutomatableParameter<number>>

    #lastChannel: byte

    #source: Option<NoteEventSource> = Option.None

    constructor(context: EngineContext, adapter: MIDIOutputDeviceBoxAdapter) {
        super(context)

        this.#adapter = adapter
        this.#audioOutput = new AudioBuffer()
        this.#parameters = []

        this.#lastChannel = adapter.box.channel.getValue()

        this.ownAll(
            adapter.box.parameters.pointerHub.catchupAndSubscribe({
                onAdded: (({box}) => this.#parameters.push(
                    this.bindParameter(adapter.parameters.parameterAt(
                        asInstanceOf(box, MIDIOutputParameterBox).value.address)))),
                onRemoved: (({box}) => {
                    Arrays.removeIf(this.#parameters, parameter =>
                        parameter.address === asInstanceOf(box, MIDIOutputParameterBox).value.address)
                })
            }),
            adapter.box.channel.subscribe(owner => {
                this.#activeNotes.forEach(pitch =>
                    context.engineToClient
                        .sendMIDIData(adapter.uuid, MidiData.noteOff(this.#lastChannel, pitch), 0))
                this.#activeNotes.length = 0
                this.#lastChannel = owner.getValue()
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
                const channel = this.#adapter.box.channel.getValue()
                if (NoteLifecycleEvent.isStart(event)) {
                    const velocityAsByte = Math.round(event.velocity * 127)
                    this.#activeNotes.push(event.pitch)
                    this.context.engineToClient
                        .sendMIDIData(this.#adapter.uuid,
                            MidiData.noteOn(channel, event.pitch, velocityAsByte), relativeTimeInMs)
                } else if (NoteLifecycleEvent.isStop(event)) {
                    const deleteIndex = this.#activeNotes.indexOf(event.pitch)
                    if (deleteIndex > -1) {
                        this.#activeNotes.splice(deleteIndex, 1)
                    }
                    this.context.engineToClient
                        .sendMIDIData(this.#adapter.uuid,
                            MidiData.noteOff(channel, event.pitch), relativeTimeInMs)
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

    parameterChanged(parameter: AutomatableParameter): void {
        const relativeTimeInMs = 0.0 // TODO Get offset to actual relative block position
        const channel = this.#adapter.box.channel.getValue()
        const controllerId = 0 // We need to find the controllerId from the UnitParameterBox
        this.context.engineToClient
            .sendMIDIData(this.#adapter.uuid,
                MidiData.control(channel, controllerId, parameter.getValue()), relativeTimeInMs)
    }

    finishProcess(): void {}

    toString(): string {return `{MIDIOutputDeviceProcessor}`}
}