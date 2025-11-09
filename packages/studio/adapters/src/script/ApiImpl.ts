import {Api, Project} from "./Api"
import {ProjectImpl} from "./ProjectImpl"
import {ProjectSkeleton} from "../project/ProjectSkeleton"
import {asInstanceOf} from "@opendaw/lib-std"

export interface ApiEnvironment {
    buildProject(skeleton: ProjectSkeleton, name?: string): void
    exitEditor(): void
}

export class ApiImplementation implements Api {
    readonly #env: ApiEnvironment

    constructor(env: ApiEnvironment) {this.#env = env}

    newProject(): Project {
        return new ProjectImpl(this.#env, ProjectSkeleton.empty({
            createDefaultUser: true,
            createOutputCompressor: false
        }))
    }

    showProject(project: Project, name?: string): void {
        this.#env.buildProject(asInstanceOf(project, ProjectImpl).skeleton, name)
        this.#env.exitEditor()
    }

    exitEditor(): void {this.#env.exitEditor()}
}