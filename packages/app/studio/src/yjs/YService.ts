import {Errors, Option, panic, RuntimeNotifier, TimeSpan} from "@opendaw/lib-std"
import {BoxGraph} from "@opendaw/lib-box"
import {Promises} from "@opendaw/lib-runtime"
import {BoxIO} from "@opendaw/studio-boxes"
import {ProjectDecoder} from "@opendaw/studio-adapters"
import {Project, ProjectEnv} from "@opendaw/studio-core"
import {YSync} from "@/yjs/YSync"
import * as Y from "yjs"
import {WebsocketProvider} from "y-websocket"

// https://inspector.yjs.dev/

export namespace YService {
    const serverDevUrl = "wss://localhost:1234"
    const serverProdUrl = "wss://live.opendaw.studio"

    const isDev = false
    const serverUrl = isDev ? serverDevUrl : serverProdUrl

    export const getOrCreateRoom = async (optProject: Option<Project>,
                                          env: ProjectEnv,
                                          roomName: string): Promise<Project> => {
        if (roomName === "signaling") {return panic("Invalid room name: signaling")}
        const doc = new Y.Doc()
        const provider: WebsocketProvider = new WebsocketProvider(serverUrl, roomName, doc)
        console.debug("Provider URL:", provider.url)
        if (!provider.synced) {
            await Promises.timeout(new Promise<void>(resolve => {
                const onSync = (isSynced: boolean) => {
                    if (isSynced) {
                        provider.off("sync", onSync)
                        resolve()
                    }
                }
                provider.on("sync", onSync)
            }), TimeSpan.seconds(10), "Timeout 'synced'")
        }
        const boxesMap = doc.getMap("boxes")
        if (boxesMap.size === 0) {
            const project = optProject.match({
                none: () => Project.new(env),
                some: project => project.copy()
            })
            const sync = await YSync.populate({boxGraph: project.boxGraph, doc, conflict: () => project.invalid()})
            project.own(sync)
            project.editing.disable()
            return project
        } else {
            if (optProject.nonEmpty()) {
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
            const project = Project.skeleton(env, {
                boxGraph,
                mandatoryBoxes: ProjectDecoder.findMandatoryBoxes(boxGraph)
            })
            project.own(sync)
            project.editing.disable()
            return project
        }
    }
}