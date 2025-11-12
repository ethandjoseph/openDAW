import {GroupAudioUnit, Send} from "../Api"
import {ProjectImpl} from "./ProjectImpl"
import {AudioUnitImpl} from "./AudioUnitImpl"
import {SendImpl} from "./SendImpl"

export class GroupAudioUnitImpl extends AudioUnitImpl implements GroupAudioUnit {
    readonly kind = "group" as const

    readonly #sends: Array<SendImpl>

    label: string

    constructor(project: ProjectImpl, props?: Partial<GroupAudioUnit>) {
        super(project, props)

        this.label = props?.label ?? "Group"

        this.#sends = []
    }

    addSend(props?: Partial<Send>): Send {
        const send = new SendImpl(props)
        this.#sends.push(send)
        return send
    }

    get sends(): ReadonlyArray<SendImpl> {return this.#sends}
}
