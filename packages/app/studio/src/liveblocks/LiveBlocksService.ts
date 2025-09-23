import {RuntimeNotifier} from "@opendaw/lib-std"
import {createClient} from "@liveblocks/client"
import {LiveblocksSync} from "@/liveblocks/LiveblocksSync"
import {getYjsProviderForRoom} from "@liveblocks/yjs"
import {StudioService} from "@/service/StudioService"
import {Promises} from "@opendaw/lib-runtime"

// TODO Inject Yjs undo-manager

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
        const result = await Promises.tryCatch(LiveblocksSync.getOrCreate(service, yjsProvider, roomName))
        console.debug(result)
        dialog.terminate()
    }
}