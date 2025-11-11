import {Instrument, InstrumentAudioUnit, Instruments, Send} from "../Api"
import {ProjectImpl} from "./ProjectImpl"
import {AudioUnitImpl} from "./AudioUnitImpl"
import {SendImpl} from "./SendImpl"
import {InstrumentImpl} from "./InstrumentImpl"

export class InstrumentAudioUnitImpl extends AudioUnitImpl implements InstrumentAudioUnit {
    readonly kind = "instrument" as const
    readonly instrument: InstrumentImpl
    readonly #sends: SendImpl[]

    constructor(project: ProjectImpl, instrumentName: keyof Instruments, props?: Partial<Instruments[keyof Instruments]>) {
        super(project)
        this.instrument = new InstrumentImpl(this, instrumentName, props)
        this.#sends = []
    }

    setInstrument(name: keyof Instruments): Instrument {
        // In a real implementation, this would swap out the instrument
        return this.instrument
    }

    addSend(props?: Partial<Send>): Send {
        const send = new SendImpl(props)
        this.#sends.push(send)
        return send
    }

    getSends(): ReadonlyArray<SendImpl> {
        return this.#sends
    }
}
