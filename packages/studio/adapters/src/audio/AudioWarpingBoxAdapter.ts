import {AudioWarpingBox} from "@opendaw/studio-boxes"
import {Notifier, Observer, Subscription, Terminator, UUID} from "@opendaw/lib-std"
import {Address} from "@opendaw/lib-box"
import {BoxAdaptersContext} from "../BoxAdaptersContext"
import {BoxAdapter} from "../BoxAdapter"
import {AudioWarpingIO} from "./AudioWarpingIO"
import {WarpMarker} from "./WarpMarker"
import {TransientMarker} from "./TransientMarker"

export class AudioWarpingBoxAdapter implements BoxAdapter {
    readonly #terminator = new Terminator()

    readonly #context: BoxAdaptersContext
    readonly #box: AudioWarpingBox
    readonly #transientNotifer: Notifier<void>

    #warps: ReadonlyArray<WarpMarker> = []
    #transients: ReadonlyArray<TransientMarker> = []

    constructor(context: BoxAdaptersContext, box: AudioWarpingBox) {
        this.#context = context
        this.#box = box

        this.#transientNotifer = new Notifier()

        this.#terminator.ownAll(
            box.wraps.catchupAndSubscribe(() => this.#warps = AudioWarpingIO.readWarpMarkers(box.wraps)),
            box.transients.catchupAndSubscribe(() => this.#transients = AudioWarpingIO.readTransientMarkers(box.transients))
        )
    }

    get box(): AudioWarpingBox {return this.#box}
    get uuid(): UUID.Bytes {return this.#box.address.uuid}
    get address(): Address {return this.#box.address}
    get transients(): ReadonlyArray<TransientMarker> {return this.#transients}
    set transients(markers: ReadonlyArray<TransientMarker>) {AudioWarpingIO.writeTransientMarkers(this.#box.transients, markers)}
    get warps(): ReadonlyArray<WarpMarker> {return this.#warps}
    set warps(markers: ReadonlyArray<WarpMarker>) {AudioWarpingIO.writeWarpMarkers(this.#box.wraps, markers)}

    subscribe(observer: Observer<void>): Subscription {return this.#transientNotifer.subscribe(observer)}

    terminate(): void {this.#terminator.terminate()}
}