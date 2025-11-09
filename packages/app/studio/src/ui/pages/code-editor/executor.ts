import {RuntimeNotifier} from "@opendaw/lib-std"
import {Chord, PPQN} from "@opendaw/lib-dsp"
import {Api, ApiImplementation, ProjectSkeleton} from "@opendaw/studio-adapters"
import {Project} from "@opendaw/studio-core"
import {StudioService} from "@/service/StudioService"

export class Executor {
    readonly #api: Api

    constructor(service: StudioService) {
        this.#api = new ApiImplementation({
            buildProject: (skeleton: ProjectSkeleton, name?: string): void => {
                const project = Project.skeleton(service, skeleton)
                service.projectProfileService.setProject(project, name ?? "Scripted")
            },
            exitEditor: () => {
                if (service.hasProfile) {
                    service.switchScreen("default")
                } else {
                    service.switchScreen("dashboard")
                }
            }
        })
    }

    async run(jsCode: string) {
        console.debug("Compiled JavaScript:")
        console.debug(jsCode)
        try {
            const globals = {
                PPQN, Chord
            }
            const scriptFunction = new Function("openDAW", "globals", `with (globals) {${jsCode}}`)
            scriptFunction(this.#api, globals)
            console.debug("Script executed successfully")
        } catch (execError) {
            console.warn(execError)
            await RuntimeNotifier.info({
                headline: "Runtime Error",
                message: String(execError)
            })
        }
    }
}