import {DelayEffect, Duration, Percent, VolumeValue} from "../Api"

export class DelayEffectImpl implements DelayEffect {
    readonly key = "delay" as const

    enabled: boolean
    delay: Duration
    feedback: Percent
    cross: Percent
    filter: Percent
    wet: VolumeValue
    dry: VolumeValue

    constructor(props?: Partial<DelayEffect>) {
        this.enabled = props?.enabled ?? true
        this.delay = props?.delay ?? "1/4"
        this.feedback = props?.feedback ?? 0.5
        this.cross = props?.cross ?? 0
        this.filter = props?.filter ?? 0
        this.wet = props?.wet ?? "50%"
        this.dry = props?.dry ?? "100%"
    }
}
