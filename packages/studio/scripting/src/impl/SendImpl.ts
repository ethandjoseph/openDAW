import {Send, VolumeValue, PanValue} from "../Api"

export class SendImpl implements Send {
    amount: VolumeValue
    pan: PanValue
    mode: "pre" | "post"

    constructor(props?: Partial<Send>) {
        this.amount = props?.amount ?? "default"
        this.pan = props?.pan ?? "center"
        this.mode = props?.mode ?? "post"
    }
}
