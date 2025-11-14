import {AudioData, Sample} from "@opendaw/studio-adapters"

export interface ScriptHostProtocol {
    openProject(buffer: ArrayBufferLike, name?: string): void

    addSample(data: AudioData, name: string): Promise<Sample>
}