import {Errors, Option, panic, RuntimeNotifier, TimeSpan} from "@opendaw/lib-std"
import {BoxGraph} from "@opendaw/lib-box"
import {Promises} from "@opendaw/lib-runtime"
import {BoxIO} from "@opendaw/studio-boxes"
import {ProjectDecoder} from "@opendaw/studio-adapters"
import {Project, ProjectEnv} from "@opendaw/studio-core"
import * as Y from "yjs"
import {WebrtcProvider} from "y-webrtc"
import {WebsocketProvider} from "y-websocket"
import {YSync} from "@/yjs/YSync"
import {StudioService} from "@/service/StudioService"
import {BinaryExchangeNetwork} from "@/yjs/BinaryExchangeNetwork"
import {ConsoleCommands} from "@opendaw/lib-dom"

// https://inspector.yjs.dev/

export namespace YService {
    const serverDevUrl = "wss://localhost:1234"
    const serverProdUrl = "wss://live.opendaw.studio"

    const isDev = true
    const serverUrl = isDev ? serverDevUrl : serverProdUrl

    export const getOrCreateRoom = async (_service: StudioService,
                                          optProject: Option<Project>,
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
        console.debug("Provider signaling servers:")
        const webrtcProvider = new WebrtcProvider(roomName, doc, {
            signaling: [`${serverUrl}/signaling`],
            filterBcConns: false
        })
        webrtcProvider.on("peers", (event) => {
            console.log("WebRTC peers changed:", {
                added: event.added,
                removed: event.removed,
                webrtcPeers: event.webrtcPeers,
                bcPeers: event.bcPeers
            })
        })
        console.log("WebRTC provider created, signaling servers:", webrtcProvider.signalingUrls)
        console.debug("Room:", webrtcProvider.room)
        console.debug("BC connections:", webrtcProvider.room?.bcConns?.size || -1)
        console.debug("WC connections:", webrtcProvider.room?.webrtcConns?.size || -1)
        const exchangeNetwork = new BinaryExchangeNetwork(webrtcProvider)

        const testData = new Uint8Array(0xFFFF)
        testData[555] = 42
        const payload = {fileName: "test.bin", type: "audio/sample"}
        ConsoleCommands.exportMethod("webrtc.test", () => {
            exchangeNetwork.sendBinary(
                testData.buffer,
                payload,
                (progress) => {
                    console.log(`Upload progress: ${Math.round(progress * 100)}%`)
                }
            )
        })

        exchangeNetwork.setTransferHandlers(
            (transferId, progress) => {
                console.log(`Download ${transferId}: ${Math.round(progress * 100)}%`)
            },
            (transferId, data, payload) => {
                console.log(`Download complete: ${transferId}`, payload)
                console.log(`Received ${data.byteLength} bytes`, testData[555])
            }
        )

        const sharedEnv = {...env}

        const boxesMap = doc.getMap("boxes")
        if (boxesMap.size === 0) {
            const project = optProject.match({
                none: () => Project.new(sharedEnv),
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
            const project = Project.skeleton(sharedEnv, {
                boxGraph,
                mandatoryBoxes: ProjectDecoder.findMandatoryBoxes(boxGraph)
            })
            project.own(sync)
            project.editing.disable()
            return project
        }
    }
}