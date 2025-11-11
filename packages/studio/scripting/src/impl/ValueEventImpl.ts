import {ValueEvent} from "../Api"
import {Interpolation, ppqn} from "@opendaw/lib-dsp"
import {int, unitValue} from "@opendaw/lib-std"

export class ValueEventImpl implements ValueEvent {
    position: ppqn
    value: unitValue
    index: int
    interpolation: Interpolation

    constructor(props?: Partial<ValueEvent>) {
        this.position = props?.position ?? 0.0 as ppqn
        this.value = props?.value ?? 0.0 as unitValue
        this.index = props?.index ?? 0 as int
        this.interpolation = props?.interpolation ?? Interpolation.Linear
    }
}
