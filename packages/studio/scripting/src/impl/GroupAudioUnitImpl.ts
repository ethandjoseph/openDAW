import {GroupAudioUnit, Send} from "../Api"
import {ProjectImpl} from "./ProjectImpl"
import {AudioUnitImpl} from "./AudioUnitImpl"
import {SendImpl} from "./SendImpl"

export class GroupAudioUnitImpl extends AudioUnitImpl implements GroupAudioUnit {
    readonly kind = "group" as const
    
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
