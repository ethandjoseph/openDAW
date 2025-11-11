import {Api, Project} from "../Api"
import {ProjectImpl} from "./ProjectImpl"
import {panic} from "@opendaw/lib-std"
import {ProjectSkeleton} from "@opendaw/studio-adapters"

export interface ApiEnvironment {
    openProject(skeleton: ProjectSkeleton, name: string): void
}

export class ApiImpl implements Api {
    constructor(readonly environment: ApiEnvironment) {}

    newProject(name?: string): Project {
        return new ProjectImpl(this, name ?? `Scripted Project`)
    }

    async getProject(): Promise<Project> {
        return panic("Not yet implemented")
    }
}
