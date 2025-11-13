import {StudioService} from "@/service/StudioService"
import {Communicator, Messenger, Promises} from "@opendaw/lib-runtime"
import {ScriptExecutionProtocol, ScriptHostProtocol} from "@opendaw/studio-scripting"
import {Project, WavFile} from "@opendaw/studio-core"
import {AudioData, ProjectDecoder} from "@opendaw/studio-adapters"
import {BoxGraph} from "@opendaw/lib-box"
import {Errors, Option, RuntimeNotifier, UUID} from "@opendaw/lib-std"
import {BoxIO} from "@opendaw/studio-boxes"
import scriptWorkerUrl from "@opendaw/studio-scripting/ScriptWorker.js?worker&url"

export class ScriptExecutor implements ScriptExecutionProtocol {
    readonly #executor: ScriptExecutionProtocol

    constructor(service: StudioService) {
        const messenger = Messenger.for(new Worker(scriptWorkerUrl, {type: "module"}))
        Communicator.executor<ScriptHostProtocol>(messenger.channel("scripting-host"), {
            openProject: (buffer: ArrayBufferLike, name?: string): void => {
                const boxGraph = new BoxGraph<BoxIO.TypeMap>(Option.wrap(BoxIO.create))
                boxGraph.fromArrayBuffer(buffer)
                const mandatoryBoxes = ProjectDecoder.findMandatoryBoxes(boxGraph)
                const project = Project.skeleton(service, {boxGraph, mandatoryBoxes})
                service.projectProfileService.setProject(project, name ?? "Scripted Project")
                service.switchScreen("default")
            },
            registerSample: (data: AudioData, name: string): Promise<UUID.Bytes> => service.sampleService.importFile({
                name, arrayBuffer: WavFile.encodeFloats({
                    channels: data.frames,
                    numFrames: data.numberOfFrames,
                    sampleRate: data.sampleRate,
                    numberOfChannels: data.numberOfChannels
                })
            }).then(({uuid}) => UUID.parse(uuid))
        })

        this.#executor = Communicator.sender<ScriptExecutionProtocol>(messenger.channel("scripting-execution"),
            dispatcher => new class implements ScriptExecutionProtocol {
                execute(script: string): Promise<void> {
                    return dispatcher.dispatchAndReturn(this.execute, script)
                }
            })
    }

    async execute(script: string): Promise<void> {
        const progressUpdater = RuntimeNotifier.progress({headline: "Executing Script..."})
        const {status, error} = await Promises.tryCatch(this.#executor.execute(script))
        progressUpdater.terminate()
        if (status === "rejected") {
            console.warn(error)
            await RuntimeNotifier.info({headline: "The script caused an error", message: Errors.toString(error)})
        }
    }
}