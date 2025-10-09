import {Progress, SortedSet, UUID} from "@opendaw/lib-std"
import {DefaultSoundfontLoader} from "./DefaultSoundfontLoader"
import {SoundfontProvider} from "./SoundfontProvider"
import {SoundfontLoader, SoundfontLoaderManager, SoundfontMetaData} from "@opendaw/studio-adapters"
import type {SoundFont2} from "soundfont2"

export class DefaultSoundfontLoaderManager implements SoundfontLoaderManager, SoundfontProvider {
    readonly #provider: SoundfontProvider
    readonly #loaders: SortedSet<UUID.Bytes, SoundfontLoader>

    constructor(provider: SoundfontProvider) {
        this.#provider = provider
        this.#loaders = UUID.newSet(loader => loader.uuid)
    }

    fetch(uuid: UUID.Bytes, progress: Progress.Handler): Promise<[ArrayBuffer, SoundfontMetaData]> {
        return this.#provider.fetch(uuid, progress)
    }

    remove(uuid: UUID.Bytes) {this.#loaders.removeByKey(uuid)}

    getOrCreate(uuid: UUID.Bytes): SoundfontLoader {
        return this.#loaders.getOrCreate(uuid, uuid => new DefaultSoundfontLoader(this, uuid))
    }
}