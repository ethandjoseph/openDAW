import {StudioService} from "@/service/StudioService"
import * as awarenessProtocol from "y-protocols/awareness.js"
import {AwarenessChanges} from "y-protocols/awareness.js"
import {Icon} from "@/ui/components/Icon"
import {IconSymbol} from "@opendaw/studio-adapters"
import {Exec} from "@opendaw/lib-std"
import {Surface} from "@/ui/surface/Surface"

interface LocalState {
    update: Exec
    remove: Exec
}

export class YAwareness {
    readonly #cursors: Map<number, LocalState>

    constructor(_service: StudioService, awareness: awarenessProtocol.Awareness) {
        this.#cursors = new Map()

        awareness.setLocalState({clientX: 0, clientY: 0})
        console.debug("clientID", awareness.clientID)

        const add = (clientID: number) => {
            console.debug("adding cursor for clientID ", clientID)
            const cursor = Icon({symbol: IconSymbol.Cursor})
            cursor.style.position = "absolute"
            Surface.get().cursors.appendChild(cursor)
            const update = () => {
                const position = awareness.getStates().get(clientID)?.cursor ?? {clientX: 0, clientY: 0}
                console.debug(clientID, position)
                return cursor.style.transform = `translate(${position.clientX - 4}px, ${position.clientY}px)`
            }
            update()
            const remove = () => cursor.remove()
            return this.#cursors.set(clientID, {update, remove})
        }

        awareness.on("change", ({added, removed, updated}: AwarenessChanges) => {
            added.filter(clientID => clientID !== awareness.clientID)
                .forEach(clientID => add(clientID))
            updated.filter(clientID => clientID !== awareness.clientID)
                .forEach(clientID => this.#cursors.get(clientID)?.update())
            removed.filter(clientID => clientID !== awareness.clientID)
                .forEach(clientID => this.#cursors.get(clientID)?.remove())
        })
        awareness.getStates().keys()
            .filter(clientID => clientID !== awareness.clientID)
            .forEach(clientID => add(clientID))
        window.addEventListener("pointermove", ({clientX, clientY}) => {
            awareness.setLocalStateField("cursor", {clientX, clientY})
        })
    }
}