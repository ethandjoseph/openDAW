import {Notifier, Observer, Subscription, Terminator, UUID} from "@opendaw/lib-std"
import {Address} from "@opendaw/lib-box"
import {Event} from "@opendaw/lib-dsp"
import {WarpMarkerBox} from "@opendaw/studio-boxes"
import {BoxAdapter} from "../BoxAdapter"

export class WarpMarkerBoxAdapter implements BoxAdapter, Event {
    readonly type = "warp-marker"
    readonly #terminator = new Terminator()

    readonly #box: WarpMarkerBox
    readonly #notifer: Notifier<void>

    constructor(box: WarpMarkerBox) {
        this.#box = box

        this.#notifer = new Notifier()
    }

    get box(): WarpMarkerBox {return this.#box}
    get uuid(): UUID.Bytes {return this.#box.address.uuid}
    get address(): Address {return this.#box.address}
    get position(): number {return this.#box.position.getValue()}
    get seconds(): number {return this.#box.seconds.getValue()}

    subscribe(observer: Observer<void>): Subscription {return this.#notifer.subscribe(observer)}

    terminate(): void {this.#terminator.terminate()}
}