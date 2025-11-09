import {Api, ProjectFactory} from "./Api"
import {ProjectFactoryImpl} from "./ProjectFactoryImpl"
import {ProjectSkeleton} from "../project/ProjectSkeleton"

export interface ApiEnvironment {
    buildProject(skeleton: ProjectSkeleton, name?: string): void
    exitEditor(): void
}

export class ApiImplementation implements Api {
    readonly #env: ApiEnvironment

    constructor(env: ApiEnvironment) {this.#env = env}

    createProjectFactory(): ProjectFactory {
        return new ProjectFactoryImpl(this.#env, ProjectSkeleton.empty({
            createDefaultUser: true,
            createOutputCompressor: false
        }))
    }

    exitEditor(): void {this.#env.exitEditor()}
}