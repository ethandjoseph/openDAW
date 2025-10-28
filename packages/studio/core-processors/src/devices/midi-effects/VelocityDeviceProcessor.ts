import {assert, int, Objects, Option, Terminable, UUID} from "@opendaw/lib-std"
import {NoteBroadcaster, VelocityDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {Event, NoteEvent, ppqn} from "@opendaw/lib-dsp"
import {EngineContext} from "../../EngineContext"
import {EventProcessor} from "../../EventProcessor"
import {Block, Processor} from "../../processing"
import {AutomatableParameter} from "../../AutomatableParameter"
import {NoteEventSource, NoteLifecycleEvent} from "../../NoteEventSource"
import {MidiEffectProcessor} from "../../MidiEffectProcessor"

export class VelocityDeviceProcessor extends EventProcessor implements MidiEffectProcessor {
    readonly #adapter: VelocityDeviceBoxAdapter

    readonly #noteBroadcaster: NoteBroadcaster

    #source: Option<NoteEventSource> = Option.None

    constructor(context: EngineContext, adapter: VelocityDeviceBoxAdapter) {
        super(context)

        this.#adapter = adapter

        this.#noteBroadcaster = this.own(new NoteBroadcaster(context.broadcaster, adapter.address))

        const {magnetPosition, magnetStrength, randomAmount, offset, mix} = adapter.namedParameter
        this.ownAll(
            this.bindParameter(magnetPosition),
            this.bindParameter(magnetStrength),
            this.bindParameter(randomAmount),
            this.bindParameter(offset),
            this.bindParameter(mix),
            context.registerProcessor(this)
        )
        this.readAllParameters()
    }

    setNoteEventSource(source: NoteEventSource): Terminable {
        assert(this.#source.isEmpty(), "NoteEventSource already set")
        this.#source = Option.wrap(source)
        return Terminable.create(() => this.#source = Option.None)
    }

    get uuid(): UUID.Bytes {return this.#adapter.uuid}
    get incoming(): Processor {return this}
    get outgoing(): Processor {return this}

    * processNotes(from: ppqn, to: ppqn, flags: int): Generator<NoteLifecycleEvent> {
        if (this.#source.isEmpty()) {return}
        for (const event of this.#source.unwrap().processNotes(from, to, flags)) {
            if (NoteLifecycleEvent.isStart(event)) {
                this.#noteBroadcaster.noteOn(event.pitch)
                yield Objects.overwrite(event, {
                    velocity: this.#adapter.computeVelocity(event.position, event.velocity)
                })
            } else {
                this.#noteBroadcaster.noteOff(event.pitch)
                yield event
            }
        }
    }

    * iterateActiveNotesAt(position: ppqn, onlyExternal: boolean): Generator<NoteEvent> {
        if (this.#source.isEmpty()) {return}
        for (const event of this.#source.unwrap().iterateActiveNotesAt(position, onlyExternal)) {
            if (event.type === "note-event") {
                yield Objects.overwrite(event, {
                    velocity: this.#adapter.computeVelocity(event.position, event.velocity)
                })
            }
        }
    }

    reset(): void {this.eventInput.clear()}

    processEvents(_block: Block, _from: ppqn, _to: ppqn): void {}

    parameterChanged(_parameter: AutomatableParameter): void {}

    handleEvent(_block: Block, _event: Event): void {}

    index(): number {return this.#adapter.indexField.getValue()}
    adapter(): VelocityDeviceBoxAdapter {return this.#adapter}
}