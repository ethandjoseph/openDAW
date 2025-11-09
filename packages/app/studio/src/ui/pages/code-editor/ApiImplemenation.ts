import {InstrumentFactories} from "@opendaw/studio-adapters"
import {Api, InstrumentMap, NoteTrack, Project, ProjectFactory} from "@opendaw/studio-core"
import {StudioService} from "@/service/StudioService"
import {panic} from "@opendaw/lib-std"

export class ApiImplementation implements Api {
    readonly #service: StudioService

    constructor(service: StudioService) {
        this.#service = service
    }

    createProjectFactory(): ProjectFactory {
        const project = Project.new(this.#service)

        return {
            createInstrument: <I extends InstrumentFactories.Keys>(instrument: I): InstrumentMap[I] => {
                project.editing.modify(() => {
                    project.api.createAnyInstrument(InstrumentFactories.Named[instrument])
                })
                switch (instrument) {
                    case "Vaporisateur":
                        return {
                            createNoteTrack: (): NoteTrack => panic("Not yet implemented")
                        }
                    default:
                        return {} as InstrumentMap[I]
                }
            },
            render: (projectName?: string): void => {
                this.#service.projectProfileService.setProject(project, projectName ?? "Scripted")
                this.#service.switchScreen("default")
            }
        }
    }
}