import {StudioService} from "@/service/StudioService"
import {Communicator, Messenger} from "@opendaw/lib-runtime"
import {ScriptExecutionProtocol, ScriptHostProtocol} from "@opendaw/studio-scripting"
import {Project} from "@opendaw/studio-core"
import {ProjectDecoder} from "@opendaw/studio-adapters"
import {BoxGraph} from "@opendaw/lib-box"
import {asDefined, Nullable, Option} from "@opendaw/lib-std"
import {BoxIO} from "@opendaw/studio-boxes"

export class ScriptExecutor implements ScriptExecutionProtocol {
    static url: Nullable<string> = null

    readonly #executor: ScriptExecutionProtocol

    constructor(service: StudioService) {
        const messenger = Messenger.for(new Worker(asDefined(ScriptExecutor.url), {type: "module"}))
        Communicator.executor<ScriptHostProtocol>(messenger.channel("scripting-host"), {
            openProject: (buffer: ArrayBufferLike, name?: string): void => {
                const boxGraph = new BoxGraph<BoxIO.TypeMap>(Option.wrap(BoxIO.create))
                boxGraph.fromArrayBuffer(buffer)
                const mandatoryBoxes = ProjectDecoder.findMandatoryBoxes(boxGraph)
                const project = Project.skeleton(service, {boxGraph, mandatoryBoxes})
                service.projectProfileService.setProject(project, name ?? "Scripted")
                service.switchScreen("default")
            }
        })

        this.#executor = Communicator.sender<ScriptExecutionProtocol>(messenger.channel("scripting-execution"),
            dispatcher => new class implements ScriptExecutionProtocol {
                execute(script: string): Promise<void> {
                    return dispatcher.dispatchAndReturn(this.execute, script)
                }
            })
    }

    async execute(script: string): Promise<void> {
        return this.#executor.execute(script)
    }
}