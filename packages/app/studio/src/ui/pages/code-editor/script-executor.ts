import {StudioService} from "@/service/StudioService"
import {Communicator, Messenger, Promises} from "@opendaw/lib-runtime"
import {ScriptExecutionContext, ScriptExecutionProtocol, ScriptHostProtocol} from "@opendaw/studio-scripting"
import {Project, WavFile} from "@opendaw/studio-core"
import {AudioData, ProjectSkeletonDecoder, ProjectSkeletonEncoder, Sample} from "@opendaw/studio-adapters"
import {BoxGraph} from "@opendaw/lib-box"
import {Option, panic, RuntimeNotifier} from "@opendaw/lib-std"
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
                const mandatoryBoxes = ProjectSkeletonDecoder.findMandatoryBoxes(boxGraph)
                const project = Project.skeleton(service, {boxGraph, mandatoryBoxes})
                service.projectProfileService.setProject(project, name ?? "Scripted Project")
                service.switchScreen("default")
            },
            fetchProject: async (): Promise<{ buffer: ArrayBuffer; name: string }> => {
                return service.projectProfileService.getValue().match({
                    none: () => panic("No project available"),
                    some: ({project, meta}) => ({
                        buffer: ProjectSkeletonEncoder.encode(project.boxGraph) as ArrayBuffer,
                        name: meta.name
                    })
                })
            },
            addSample: (data: AudioData, name: string): Promise<Sample> => service.sampleService.importFile({
                name, arrayBuffer: WavFile.encodeFloats({
                    channels: data.frames,
                    numFrames: data.numberOfFrames,
                    sampleRate: data.sampleRate,
                    numberOfChannels: data.numberOfChannels
                })
            })
        })

        this.#executor = Communicator.sender<ScriptExecutionProtocol>(messenger.channel("scripting-execution"),
            dispatcher => new class implements ScriptExecutionProtocol {
                execute(script: string, context: ScriptExecutionContext): Promise<void> {
                    return dispatcher.dispatchAndReturn(this.execute, script, context)
                }
            })
    }

    async execute(script: string, context: ScriptExecutionContext): Promise<void> {
        const progressUpdater = RuntimeNotifier.progress({headline: "Executing Script..."})
        const {status, error} = await Promises.tryCatch(this.#executor.execute(script, context))
        progressUpdater.terminate()
        if (status === "rejected") {
            console.warn(error)
            await RuntimeNotifier.info({headline: "The script caused an error", message: String(error)})
        }
    }
}