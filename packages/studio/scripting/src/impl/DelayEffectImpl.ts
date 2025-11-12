import {DelayEffect} from "../Api"

export class DelayEffectImpl implements DelayEffect {
    readonly key = "delay" as const

    label: string
    enabled: boolean
    delay: number
    feedback: number
    cross: number
    filter: number
    wet: number
    dry: number

    constructor(props?: Partial<DelayEffect>) {
        this.label = props?.label ?? "Delay"
        this.enabled = props?.enabled ?? true
        this.delay = props?.delay ?? 4
        this.feedback = props?.feedback ?? 0.5
        this.cross = props?.cross ?? 0
        this.filter = props?.filter ?? 0
        this.wet = props?.wet ?? -6.0
        this.dry = props?.dry ?? 0.0
    }
}
