import "./style.css"
import {createClient, LiveMap, LiveObject} from "@liveblocks/client"
import {isUndefined, JSONValue, Option, Optional, UUID} from "@opendaw/lib-std"
import {BoxGraph, Update} from "@opendaw/lib-box"
import {BoxIO, TimelineBox} from "@opendaw/studio-boxes"
import {BoxLiveObject, Liveblocks} from "./liveblocks"

const publicApiKey = "pk_dev_rAx9bMAt_7AW8Ha_s3xkqd-l_9lYElzlpfOCImMJRSZYnhJ4uI5TelBFtbKUeWP4"

;(async () => {
    console.debug(publicApiKey)

    const client = createClient({publicApiKey, throttle: 80})
    const {room} = client.enterRoom("opendaw-sandbox")
    const {root} = await room.getStorage()

    const graph = new BoxGraph(Option.wrap(BoxIO.create))
    graph.subscribeToAllUpdates({
        onUpdate: (update: Update) => {
            if (update.type === "primitive") {
                const boxRoot = boxes.get(UUID.toString(update.address.uuid)) as LiveObject<BoxLiveObject>
                Liveblocks.updatePrimitiveInBoxLiveObject(boxRoot, update)
            }
        }
    })

    const subscribeToBox = (boxId: string, box: LiveObject<BoxLiveObject>) => {
        room.subscribe(box, (events) => {
            console.debug(`Box ${boxId} (${box.get("name")}) was updated:`, events)
            // TODO Handle the box update here
        }, {isDeep: true})
    }

    const getBoxes = (): LiveMap<string, LiveObject<BoxLiveObject>> => {
        let boxes = root.get("boxes") as Optional<LiveMap<string, LiveObject<BoxLiveObject>>>
        if (isUndefined(boxes)) {
            console.debug("Creating boxes")
            boxes = new LiveMap<string, LiveObject<BoxLiveObject>>()

            graph.beginTransaction()
            const box = TimelineBox.create(graph, UUID.Lowest, box => {
                box.loopArea.from.setValue(0xFFFF)
                box.loopArea.to.setValue(0xFFFF)
            })
            graph.endTransaction()

            boxes.set(box.address.toString(), Liveblocks.boxToLiveObject(box))
            root.set("boxes", boxes)
            console.debug("installed > ignore error & reload")
        }
        return boxes
    }

    const boxes = getBoxes()

    console.debug("boxes", boxes.size)
    graph.beginTransaction()
    boxes.forEach(object => {
        const name = object.get("name")
        console.debug(`load box '${name}'`)
        const id = object.get("id")
        const uuid = UUID.parse(id)
        const box = graph.createBox(name as keyof BoxIO.TypeMap, uuid, box => box.fromJSON(object.toImmutable().fields as JSONValue)) as TimelineBox
        console.debug(`[start] from: ${box.loopArea.from.getValue()}, to: ${box.loopArea.to.getValue()}`)
        subscribeToBox(id, object)
    })
    graph.endTransaction()

    room.subscribe(boxes, (events) => {
        console.debug("Boxes map changed:", events)
    })

    window.onpointerdown = () => {
        graph.beginTransaction()
        const box = graph.findBox(UUID.Lowest).unwrap() as TimelineBox
        box.loopArea.from.setValue(Math.floor(Math.random() * 128))
        box.loopArea.to.setValue(Math.floor(Math.random() * 0xFFFF))
        console.debug(`[update] from: ${box.loopArea.from.getValue()}, to: ${box.loopArea.to.getValue()}`)
        graph.endTransaction()
    }
})()