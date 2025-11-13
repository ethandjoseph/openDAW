import {AuxAudioUnit, GroupAudioUnit, Send} from "../Api"
import {ProjectImpl} from "./ProjectImpl"
import {AudioUnitImpl} from "./AudioUnitImpl"
import {SendImpl} from "./SendImpl"
import {Arrays} from "@opendaw/lib-std"

export class AuxAudioUnitImpl extends AudioUnitImpl implements AuxAudioUnit {
    readonly kind = "auxiliary" as const

    readonly #sends: Array<SendImpl>

    label: string

    constructor(project: ProjectImpl, props?: Partial<GroupAudioUnit>) {
        super(project, props)

        this.label = props?.label ?? "FX Track"

        this.#sends = []
    }

    addSend(target: AuxAudioUnit | GroupAudioUnit, props?: Partial<Send>): Send {
        const send = new SendImpl(target, props)
        this.#sends.push(send)
        return send
    }

    removeSend(send: Send): void {Arrays.remove(this.#sends, send)}

    get sends(): ReadonlyArray<SendImpl> {return this.#sends}
}
