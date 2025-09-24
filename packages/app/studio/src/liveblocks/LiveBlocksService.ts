import {Errors, Option, RuntimeNotifier} from "@opendaw/lib-std"
import {Promises} from "@opendaw/lib-runtime"
import {BoxGraph} from "@opendaw/lib-box"
import {BoxIO} from "@opendaw/studio-boxes"
import {ProjectDecoder} from "@opendaw/studio-adapters"
import {Project} from "@opendaw/studio-core"
import {StudioService} from "@/service/StudioService"
import {YSync} from "@/liveblocks/YSync"
import {createClient} from "@liveblocks/client"
import {getYjsProviderForRoom, LiveblocksYjsProvider} from "@liveblocks/yjs"
import * as Y from "yjs"

// TODO Inject Yjs undo-manager
//  https://docs.yjs.dev/

export namespace LiveBlocksService {
    export const getOrCreateRoom = async (service: StudioService, publicApiKey: string, roomName: string) => {
        const dialog = RuntimeNotifier.progress({
            headline: "Looking Up Room",
            message: "Please wait while the room is being loaded..."
        })
        const client = createClient({publicApiKey, throttle: 16})
        const {room} = client.enterRoom(roomName)
        await room.waitUntilStorageReady()
        await room.waitUntilPresenceReady()
        const yjsProvider = getYjsProviderForRoom(room)
        const result = await Promises.tryCatch(getOrCreateWithLiveblocksYjsProvider(service, yjsProvider, roomName))
        console.debug(result)
        dialog.terminate()
    }

    export const getOrCreateWithLiveblocksYjsProvider = async (service: StudioService,
                                                               provider: LiveblocksYjsProvider,
                                                               roomName: string): Promise<void> => {
        console.debug("getOrCreate", roomName)
        const doc: Y.Doc = provider.getYDoc()
        await new Promise<void>((resolve) => {
            if (provider.synced) {
                resolve()
            } else {
                provider.on("synced", resolve)
            }
        })
        const isEmpty = YSync.isEmpty(doc)
        if (isEmpty) {
            if (!service.hasProfile) {
                await service.cleanSlate()
            }
            const project = service.project
            const sync = await YSync.populate({boxGraph: project.boxGraph, doc, conflict: () => project.invalid()})
            project.own(sync)
            project.editing.disable()
        } else {
            if (service.hasProfile) {
                const approved = await RuntimeNotifier.approve({
                    headline: "Room Already Exists",
                    message: "Do you want to join it?",
                    approveText: "Join",
                    cancelText: "Cancel"
                })
                if (!approved) {
                    return Promise.reject(Errors.AbortError)
                }
            }
            const boxGraph = new BoxGraph<BoxIO.TypeMap>(Option.wrap(BoxIO.create))
            const sync = await YSync.join({boxGraph, doc, conflict: () => project.invalid()})
            const project = Project.skeleton(service, {
                boxGraph,
                mandatoryBoxes: ProjectDecoder.findMandatoryBoxes(boxGraph)
            })
            project.own(sync)
            project.editing.disable()
            service.fromProject(project, roomName)
        }
    }
}