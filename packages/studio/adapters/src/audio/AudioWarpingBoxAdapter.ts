import {AudioWarpingBox} from "@opendaw/studio-boxes"
import {ByteArrayInput, Terminator, UUID} from "@opendaw/lib-std"
import {Address} from "@opendaw/lib-box"
import {BoxAdaptersContext} from "../BoxAdaptersContext"
import {BoxAdapter} from "../BoxAdapter"

export class AudioWarpingBoxAdapter implements BoxAdapter {
    readonly #terminator = new Terminator()

    readonly #context: BoxAdaptersContext
    readonly #box: AudioWarpingBox

    constructor(context: BoxAdaptersContext, box: AudioWarpingBox) {
        this.#context = context
        this.#box = box

        this.#terminator.ownAll(
            box.transients.catchupAndSubscribe(owner => {
                const buffer = owner.getValue().buffer
                if (buffer.byteLength === 0) {return}
                const bytes = new ByteArrayInput(buffer)
                const version = bytes.readByte()
                console.debug("version", version)
                const numberOfEntries = bytes.readInt()
                for (let i = 0; i < numberOfEntries; i++) {
                    const seconds = bytes.readFloat()
                    // TODO store into a Float32Array
                }
            })
        )
    }

    get box(): AudioWarpingBox {return this.#box}
    get uuid(): UUID.Bytes {return this.#box.address.uuid}
    get address(): Address {return this.#box.address}

    terminate(): void {this.#terminator.terminate()}
}