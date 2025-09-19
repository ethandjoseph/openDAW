import "./style.css"
import {createClient, LiveMap, LiveObject} from "@liveblocks/client"
import {isUndefined, Option, Optional, UUID} from "@opendaw/lib-std"
import {BoxGraph} from "@opendaw/lib-box"
import {BoxIO, TimelineBox} from "@opendaw/studio-boxes"
import {BoxLiveObject, Mapper} from "./liveblocks/Mapper"

const publicApiKey = "pk_dev_rAx9bMAt_7AW8Ha_s3xkqd-l_9lYElzlpfOCImMJRSZYnhJ4uI5TelBFtbKUeWP4"

;(async () => {
    console.debug(publicApiKey)

    const client = createClient({publicApiKey, throttle: 80})
    const {room} = client.enterRoom("opendaw-sandbox")
    const {root} = await room.getStorage()
    const getBoxes = (): LiveMap<string, LiveObject<BoxLiveObject>> => {
        let boxes = root.get("boxes") as Optional<LiveMap<string, LiveObject<BoxLiveObject>>>
        if (isUndefined(boxes)) {
            console.debug("Creating boxes")
            boxes = new LiveMap<string, LiveObject<BoxLiveObject>>()
            root.set("boxes", boxes)
        }
        return boxes
    }

    const boxes = getBoxes()
    const boxGraph = new BoxGraph(Option.wrap(BoxIO.create))
    const mapper = new Mapper<BoxIO.TypeMap>(boxGraph, room, boxes)

    room.subscribe(boxes, (events) => {
        console.debug("Boxes map changed:", events)
    })

    window.onpointerdown = () => {
        console.debug("CLICK")
        mapper.debugAction(() => {
            const box = boxGraph.findBox(UUID.Lowest).unwrap() as TimelineBox
            box.loopArea.from.setValue(Math.floor(Math.random() * 0xFFFF))
            box.loopArea.to.setValue(Math.floor(Math.random() * 0xFFFF))
            console.debug(`[update] from: ${box.loopArea.from.getValue()}, to: ${box.loopArea.to.getValue()}`)
        })
    }
})()