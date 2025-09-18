import "./style.css"
import {createClient} from "@liveblocks/client"

const publicApiKey = "pk_dev_rAx9bMAt_7AW8Ha_s3xkqd-l_9lYElzlpfOCImMJRSZYnhJ4uI5TelBFtbKUeWP4"

;(async () => {
    console.debug(publicApiKey)

    const client = createClient({publicApiKey, throttle: 80})
    const {room} = client.enterRoom("opendaw-sandbox")

    const {root} = await room.getStorage()
    console.debug(room)
    console.debug(root)

    /*let boxes: LiveMap<string, LiveObject<any>> | undefined = root.get("boxes")
    if (isAbsent(boxes)) {
        console.debug("Create boxes")
        const graph = new BoxGraph()
        graph.beginTransaction()
        const eventBox = NoteEventBox.create(graph, UUID.generate(), box => box.pitch.setValue(72))
        graph.endTransaction()
        const boxes = root.get("boxes")
        boxes = new LiveMap<string, LiveObject<any>>()
        boxes.set(eventBox.address.toString(), Liveblocks.boxToLiveObject(eventBox))
    } else {
        console.debug("Load boxes", boxes)
    }*/
})()