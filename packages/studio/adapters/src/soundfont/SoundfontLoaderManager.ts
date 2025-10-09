import {UUID} from "@opendaw/lib-std"
import {SoundfontLoader} from "./SoundfontLoader"

export interface SoundfontLoaderManager {
    getOrCreate(uuid: UUID.Bytes): SoundfontLoader
    record(loader: SoundfontLoader): void
    invalidate(uuid: UUID.Bytes): void
    remove(uuid: UUID.Bytes): void
}