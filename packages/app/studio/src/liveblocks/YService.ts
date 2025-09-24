import {StudioService} from "@/service/StudioService"
import {WebsocketProvider} from "y-websocket"
import * as Y from "yjs"
import {Errors, Option, RuntimeNotifier} from "@opendaw/lib-std"
import {YSync} from "@/liveblocks/YSync"
import {BoxGraph} from "@opendaw/lib-box"
import {BoxIO} from "@opendaw/studio-boxes"
import {Project} from "@opendaw/studio-core"
import {ProjectDecoder} from "@opendaw/studio-adapters"

// https://inspector.yjs.dev/

export namespace YService {
    export const getOrCreateRoom = async (service: StudioService, roomName: string) => {
        const doc = new Y.Doc()
        const provider = new WebsocketProvider("wss://live.opendaw.studio", roomName, doc)
        if (!provider.synced) {
            console.debug("waiting for sync ", roomName)
            await new Promise<void>(resolve => {
                const onSync = (isSynced: boolean) => {
                    console.debug("sync event", isSynced)
                    if (isSynced) {
                        provider.off("sync", onSync)
                        resolve()
                    }
                }
                provider.on("sync", onSync)
            })
        }
        const boxesMap = doc.getMap("boxes")
        if (boxesMap.size === 0) {
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