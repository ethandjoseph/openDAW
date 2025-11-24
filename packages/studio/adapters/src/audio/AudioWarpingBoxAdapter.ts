import {AudioWarpingBox} from "@opendaw/studio-boxes"
import {Notifier, Observer, Subscription, Terminator, UUID} from "@opendaw/lib-std"
import {Address} from "@opendaw/lib-box"
import {BoxAdaptersContext} from "../BoxAdaptersContext"
import {BoxAdapter} from "../BoxAdapter"
import {AudioWarping} from "./AudioWarping"
import {WarpMarker} from "./WarpMarker"

export class AudioWarpingBoxAdapter implements BoxAdapter {
    readonly #terminator = new Terminator()

    readonly #context: BoxAdaptersContext
    readonly #box: AudioWarpingBox
    readonly #transientNotifer: Notifier<void>

    #transients: Float32Array = new Float32Array(0)
    #warps: ReadonlyArray<WarpMarker> = []

    constructor(context: BoxAdaptersContext, box: AudioWarpingBox) {
        this.#context = context
        this.#box = box

        this.#transientNotifer = new Notifier()

        this.#terminator.ownAll(
            box.wraps.catchupAndSubscribe(() => this.#warps = AudioWarping.readWarpMarkers(box.wraps)),
            box.transients.catchupAndSubscribe(() => this.#transients = AudioWarping.readTransients(box.transients))
        )
    }

    get box(): AudioWarpingBox {return this.#box}
    get uuid(): UUID.Bytes {return this.#box.address.uuid}
    get address(): Address {return this.#box.address}
    get transients(): Float32Array {return this.#transients}
    get warps(): ReadonlyArray<WarpMarker> {return this.#warps}
    set transients(positions: Float32Array) {AudioWarping.writeTransients(this.#box.transients, positions)}

    subscribe(observer: Observer<void>): Subscription {return this.#transientNotifer.subscribe(observer)}

    terminate(): void {this.#terminator.terminate()}
}