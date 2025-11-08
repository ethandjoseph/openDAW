import {InstrumentMap} from "@opendaw/studio-core/script/Api"
import {InstrumentFactories, Project} from "@opendaw/studio-core"
import {StudioService} from "@/service/StudioService"

export class ApiImplementation {
    readonly #service: StudioService
    readonly #project: Project

    constructor(service: StudioService) {
        this.#service = service
        this.#project = Project.new(service)
    }

    createInstrument<I extends keyof InstrumentMap>(instrument: I): InstrumentMap[I] {
        this.#project.editing.modify(() => {
            this.#project.api.createAnyInstrument(InstrumentFactories.Named[instrument])
        })
        return {} as InstrumentMap[I]
    }

    create(): void {
        this.#service.projectProfileService.setProject(this.#project, "Scripted")
        this.#service.switchScreen("default")
    }
}