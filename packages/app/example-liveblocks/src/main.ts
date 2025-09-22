import "./style.css"
import {createClient, LiveMap, LiveObject} from "@liveblocks/client"
import {isUndefined, Option, UUID} from "@opendaw/lib-std"
import {BoxGraph} from "@opendaw/lib-box"
import {BoxIO, NoteEventBox, NoteEventCollectionBox, TimelineBox} from "@opendaw/studio-boxes"
import {BoxLiveObject, LiveblocksSync, ProjectRoot} from "./liveblocks/LiveblocksSync"

const publicApiKey = "pk_dev_rAx9bMAt_7AW8Ha_s3xkqd-l_9lYElzlpfOCImMJRSZYnhJ4uI5TelBFtbKUeWP4"

;(async () => {
    console.debug(publicApiKey)

    const client = createClient({publicApiKey, throttle: 80})
    const {room} = client.enterRoom("opendaw-sandbox")
    const {root} = await room.getStorage()
    const boxGraph = new BoxGraph(Option.wrap(BoxIO.create))

    const getOrCreateProjectRoot = (): LiveObject<ProjectRoot> => {
        let projectRoot = root.get("project") as LiveObject<ProjectRoot>
        if (isUndefined(projectRoot)) {
            projectRoot = new LiveObject({boxes: new LiveMap<string, LiveObject<BoxLiveObject>>()})
            root.set("project", projectRoot)
        }
        return projectRoot
    }

    const projectRoot = getOrCreateProjectRoot()
    const boxes = projectRoot.get("boxes")
    console.debug("projectRoot", projectRoot)
    const sync = new LiveblocksSync<BoxIO.TypeMap>(boxGraph, room, projectRoot)

    if (!boxes.has(UUID.toString(UUID.Lowest))) {
        console.debug("creating initial box")
        boxGraph.beginTransaction()
        TimelineBox.create(boxGraph, UUID.Lowest)
        boxGraph.endTransaction()
    }

    window.onpointerdown = (event) => {
        console.debug("CLICK", event.shiftKey)
        if (event.shiftKey) {
            sync.localEdit(() => {
                const x = NoteEventCollectionBox.create(boxGraph, UUID.generate())
                NoteEventBox.create(boxGraph, UUID.generate(), box => box.events.refer(x.events))
                NoteEventBox.create(boxGraph, UUID.generate(), box => box.events.refer(x.events))
            })
        } else {
            sync.localEdit(() => {
                const box = boxGraph.findBox(UUID.Lowest).unwrap() as TimelineBox
                box.loopArea.from.setValue(Math.floor(Math.random() * 0xFFFF))
                box.loopArea.to.setValue(Math.floor(Math.random() * 0xFFFF))
                console.debug(`[update] from: ${box.loopArea.from.getValue()}, to: ${box.loopArea.to.getValue()}`)
            })
        }
    }
})()