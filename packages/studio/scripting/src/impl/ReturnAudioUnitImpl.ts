import {ReturnAudioUnit, Send} from "../Api"
import {ProjectImpl} from "./ProjectImpl"
import {AudioUnitImpl} from "./AudioUnitImpl"
import {SendImpl} from "./SendImpl"

export class ReturnAudioUnitImpl extends AudioUnitImpl implements ReturnAudioUnit {
    readonly kind = "return" as const
    
    #sends: SendImpl[]

    constructor(project: ProjectImpl) {
        super(project)
        this.#sends = []
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
