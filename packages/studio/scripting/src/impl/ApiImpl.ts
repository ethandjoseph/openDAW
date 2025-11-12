import {Api, Project} from "../Api"
import {ProjectImpl} from "./ProjectImpl"
import {panic} from "@opendaw/lib-std"

import {ScriptHostProtocol} from "../ScriptHostProtocol"

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
}