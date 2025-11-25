import {AudioWarpingBox} from "@opendaw/studio-boxes"
import {Notifier, Observer, SortedSet, Subscription, Terminator, UUID} from "@opendaw/lib-std"
import {Address, PointerField} from "@opendaw/lib-box"
import {BoxAdaptersContext} from "../BoxAdaptersContext"
import {BoxAdapter} from "../BoxAdapter"
import {EventCollection} from "@opendaw/lib-dsp"
import {WarpMarkerBoxAdapter} from "./WarpMarkerBoxAdapter"
import {TransientMarkerBoxAdapter} from "./TransientMarkerBoxAdapter"

export class AudioWarpingBoxAdapter implements BoxAdapter {
    readonly #terminator = new Terminator()

    readonly #context: BoxAdaptersContext
    readonly #box: AudioWarpingBox
    readonly #notifer: Notifier<void>

    readonly #warpMarkerAdapters: SortedSet<UUID.Bytes, WarpMarkerBoxAdapter>
    readonly #warpMarkers: EventCollection<WarpMarkerBoxAdapter>
    readonly #transientMarkerAdapters: SortedSet<UUID.Bytes, TransientMarkerBoxAdapter>
    readonly #transientMarkers: EventCollection<TransientMarkerBoxAdapter>

    constructor(context: BoxAdaptersContext, box: AudioWarpingBox) {
        this.#context = context
        this.#box = box

        this.#notifer = new Notifier()
        this.#warpMarkerAdapters = UUID.newSet(({uuid}) => uuid)
        this.#warpMarkers = EventCollection.create()
        this.#transientMarkerAdapters = UUID.newSet(({uuid}) => uuid)
        this.#transientMarkers = EventCollection.create()
        this.#terminator.ownAll(
            box.warpMarkers.pointerHub.catchupAndSubscribe({
                onAdded: (pointer: PointerField) => {
                    const marker = this.#context.boxAdapters.adapterFor(pointer.box, WarpMarkerBoxAdapter)
                    if (this.#warpMarkerAdapters.add(marker)) {
                        this.#warpMarkers.add(marker)
                        this.#notifer.notify()
                    }
                },
                onRemoved: ({box: {address: {uuid}}}) => {
                    this.#warpMarkers.remove(this.#warpMarkerAdapters.removeByKey(uuid))
                    this.#notifer.notify()
                }
            }),
            box.transientMarkers.pointerHub.catchupAndSubscribe({
                onAdded: (pointer: PointerField) => {
                    const marker = this.#context.boxAdapters.adapterFor(pointer.box, TransientMarkerBoxAdapter)
                    if (this.#transientMarkerAdapters.add(marker)) {
                        this.#transientMarkers.add(marker)
                        this.#notifer.notify()
                    }
                },
                onRemoved: ({box: {address: {uuid}}}) => {
                    this.#transientMarkers.remove(this.#transientMarkerAdapters.removeByKey(uuid))
                    this.#notifer.notify()
                }
            })
        )
    }

    get box(): AudioWarpingBox {return this.#box}
    get uuid(): UUID.Bytes {return this.#box.address.uuid}
    get address(): Address {return this.#box.address}
    get warpMarkers(): EventCollection<WarpMarkerBoxAdapter> {return this.#warpMarkers}
    get transientMarkers(): EventCollection<TransientMarkerBoxAdapter> {return this.#transientMarkers}

    subscribe(observer: Observer<void>): Subscription {return this.#notifer.subscribe(observer)}
    onChanged(): void {
        this.#notifer.notify()
    }

    terminate(): void {this.#terminator.terminate()}
}