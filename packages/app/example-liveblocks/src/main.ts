import "./style.css"
import {createClient, LiveMap, LiveObject} from "@liveblocks/client"
import {isUndefined, Option, UUID} from "@opendaw/lib-std"
import {BoxGraph} from "@opendaw/lib-box"
import {BoxIO, TimelineBox} from "@opendaw/studio-boxes"
import {BoxLiveObject, Mapper, ProjectRoot} from "./liveblocks/Mapper"

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
    const mapper = new Mapper<BoxIO.TypeMap>(boxGraph, room, projectRoot)

    // TODO There is a bug, that updates are not seen, when we needed to initially populate the boxes.
    //  1. Clear storage
    //  2. Open first page (will create box)
    //  3. Open second page and click to update > first page does not see this update

    if (!boxes.has(UUID.toString(UUID.Lowest))) {
        boxGraph.beginTransaction()
        const timelineBox = TimelineBox.create(boxGraph, UUID.Lowest)
        boxGraph.endTransaction()
        boxes.set(timelineBox.address.toString(), mapper.boxToLiveObject(timelineBox))
    }

    room.subscribe(boxes, (events) => {
        console.debug("Boxes map changed:", events)
    })

    window.onpointerdown = () => {
        console.debug("CLICK")
        mapper.debugEdit(() => {
            const box = boxGraph.findBox(UUID.Lowest).unwrap() as TimelineBox
            box.loopArea.from.setValue(Math.floor(Math.random() * 0xFFFF))
            box.loopArea.to.setValue(Math.floor(Math.random() * 0xFFFF))
            console.debug(`[update] from: ${box.loopArea.from.getValue()}, to: ${box.loopArea.to.getValue()}`)
        })
    }
})()