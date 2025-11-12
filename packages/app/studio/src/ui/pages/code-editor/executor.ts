import {RuntimeNotifier} from "@opendaw/lib-std"
import {Chord, Interpolation, PPQN} from "@opendaw/lib-dsp"
import {ProjectSkeleton} from "@opendaw/studio-adapters"
import {Project} from "@opendaw/studio-core"
import {StudioService} from "@/service/StudioService"
import {Api, ApiImpl} from "@opendaw/studio-scripting"

export class Executor {
    readonly #api: Api

    constructor(service: StudioService) {
        this.#api = new ApiImpl({
            openProject(skeleton: ProjectSkeleton, name?: string): void {
                const project = Project.skeleton(service, skeleton)
                service.projectProfileService.setProject(project, name ?? "Scripted")
                service.switchScreen("default")
            }
        })
    }

    async run(jsCode: string) {
        console.debug("Compiled JavaScript:")
        console.debug(jsCode)
        try {
            const globals = {
                PPQN, Chord, Interpolation,
                openDAW: this.#api
            }
            Object.assign(globalThis, globals)

            const blob = new Blob([jsCode], { type: 'text/javascript' })
            const url = URL.createObjectURL(blob)

            try {
                await import(url)
                console.debug("Script executed successfully")
            } finally {
                URL.revokeObjectURL(url)
            }
        } catch (execError) {
            console.warn(execError)
            await RuntimeNotifier.info({
                headline: "Runtime Error",
                message: String(execError)
            })
        }
    }
}