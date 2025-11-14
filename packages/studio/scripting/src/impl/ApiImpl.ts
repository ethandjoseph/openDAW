import {Api, Project} from "../Api"
import {ProjectImpl} from "./ProjectImpl"
import {panic} from "@opendaw/lib-std"
import {ScriptHostProtocol} from "../ScriptHostProtocol"
import {AudioData, Sample} from "@opendaw/studio-adapters"

export class ApiImpl implements Api, ScriptHostProtocol {
    readonly #protocol: ScriptHostProtocol

    constructor(protocol: ScriptHostProtocol) {this.#protocol = protocol}

    newProject(name?: string): Project {
        return new ProjectImpl(this, name ?? `Scripted Project`)
    }

    async getProject(): Promise<Project> {
        return panic("Not yet implemented")
    }

    openProject(buffer: ArrayBufferLike, name?: string): void {
        this.#protocol.openProject(buffer, name)
    }

    addSample(data: AudioData, name: string): Promise<Sample> {
        return this.#protocol.addSample(data, name)
    }
}