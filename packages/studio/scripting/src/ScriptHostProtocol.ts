import {UUID} from "@opendaw/lib-std"
import {AudioData} from "@opendaw/studio-adapters"

export interface ScriptHostProtocol {
    openProject(buffer: ArrayBufferLike, name?: string): void

    registerSample(data: AudioData, name: string): Promise<UUID.Bytes>
}