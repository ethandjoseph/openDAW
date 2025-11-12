import {Send} from "../Api"

export class SendImpl implements Send {
    amount: number
    pan: bipolar
    mode: "pre" | "post"

    constructor(props?: Partial<Send>) {
        this.amount = props?.amount ?? 0.0
        this.pan = props?.pan ?? 0.0
        this.mode = props?.mode ?? "post"
    }
}
