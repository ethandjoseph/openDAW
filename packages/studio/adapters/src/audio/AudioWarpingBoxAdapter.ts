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
    readonly #notifer: Notifier<void>

    #warpMarkers: ReadonlyArray<WarpMarker> = []
    #transientMarkers: ReadonlyArray<TransientMarker> = []

    constructor(context: BoxAdaptersContext, box: AudioWarpingBox) {
        this.#context = context
        this.#box = box

        this.#notifer = new Notifier()
        this.#terminator.ownAll(
            box.warpMarkers.catchupAndSubscribe(() => {
                this.#warpMarkers = AudioWarpingIO.readWarpMarkers(box.warpMarkers)
                this.#notifer.notify()
            }),
            box.transientMarkers.catchupAndSubscribe(() => {
                this.#transientMarkers = AudioWarpingIO.readTransientMarkers(box.transientMarkers)
                this.#notifer.notify()
            })
        )
    }

    get box(): AudioWarpingBox {return this.#box}
    get uuid(): UUID.Bytes {return this.#box.address.uuid}
    get address(): Address {return this.#box.address}
    get transientMarkers(): ReadonlyArray<TransientMarker> {return this.#transientMarkers}
    set transientMarkers(markers: ReadonlyArray<TransientMarker>) {
        AudioWarpingIO.writeTransientMarkers(this.#box.transientMarkers, markers)
    }
    get warpMarkers(): ReadonlyArray<WarpMarker> {return this.#warpMarkers}
    set warpMarkers(markers: ReadonlyArray<WarpMarker>) {
        AudioWarpingIO.writeWarpMarkers(this.#box.warpMarkers, markers)
    }

    subscribe(observer: Observer<void>): Subscription {return this.#notifer.subscribe(observer)}

    terminate(): void {this.#terminator.terminate()}
}