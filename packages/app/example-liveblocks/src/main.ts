import "./style.css"
import {createClient, LiveMap, LiveObject} from "@liveblocks/client"
import {isUndefined, JSONValue, Option, Optional, UUID} from "@opendaw/lib-std"
import {BoxGraph} from "@opendaw/lib-box"
import {BoxIO, TimelineBox} from "@opendaw/studio-boxes"
import {AnyLiveNode, BoxLiveObject, Liveblocks} from "./liveblocks"

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

    let ignoreUpdate = false

    const boxes = getBoxes()
    const boxGraph = new BoxGraph(Option.wrap(BoxIO.create))
    const liveblocks = new Liveblocks<BoxIO.TypeMap>(boxGraph, boxes)

    const subscribeToBox = (liveObject: LiveObject<BoxLiveObject>) => {
        room.subscribe(liveObject, ([event]) => {
            if (ignoreUpdate) {return}
            console.debug("-- ROOM CHANGE --- inTransaction", boxGraph.inTransaction())
            boxGraph.beginTransaction()
            const id = liveObject.get("id")
            const box = boxGraph.findBox(UUID.parse(id)).unwrap("Could not locate box")
            console.debug(`Box ${id} (${liveObject.get("name")}) was updated:`, event)
            const node = event.node as AnyLiveNode
            const fieldKeys = liveblocks.fieldKeysForAnyLiveNode(node)
            Object.entries(event.updates).forEach(([key, value]) => {
                console.debug(`We have an '${value?.type}' at: [${fieldKeys},${key}]. value: '${node.get(key)}'`)
                const target = box.searchVertex(new Int16Array([...fieldKeys, parseInt(key)]))
                    .unwrap("Could not locate field to be updated")
                target.fromJSON(node.get(key) as JSONValue)
            })
            ignoreUpdate = true
            boxGraph.endTransaction()
            ignoreUpdate = false
        }, {isDeep: true})
    }

    console.debug(">>> boxes", boxes.size)
    boxGraph.beginTransaction()
    boxes.forEach((object: LiveObject<BoxLiveObject>) => {
        const box = liveblocks.createNewBoxFromLiveObject(boxGraph, object) as TimelineBox
        console.debug(`[start] from: ${box.loopArea.from.getValue()}, to: ${box.loopArea.to.getValue()}`)
        subscribeToBox(object)
    })
    boxGraph.endTransaction()
    console.debug("<<< boxes")

    room.subscribe(boxes, (events) => {
        console.debug("Boxes map changed:", events)
    })

    window.onpointerdown = () => {
        console.debug("CLICK")
        boxGraph.beginTransaction()
        const box = boxGraph.findBox(UUID.Lowest).unwrap() as TimelineBox
        box.loopArea.from.setValue(Math.floor(Math.random() * 128))
        box.loopArea.to.setValue(Math.floor(Math.random() * 0xFFFF))
        console.debug(`[update] from: ${box.loopArea.from.getValue()}, to: ${box.loopArea.to.getValue()}`)
        ignoreUpdate = true
        boxGraph.endTransaction()
        ignoreUpdate = false
    }
})()