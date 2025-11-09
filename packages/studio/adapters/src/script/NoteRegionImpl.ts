import {NoteEventParams, NoteRegion} from "./Api"
import {asInstanceOf, UUID} from "@opendaw/lib-std"
import {PPQN} from "@opendaw/lib-dsp"
import {BoxGraph} from "@opendaw/lib-box"
import {NoteEventBox, NoteEventCollectionBox, NoteRegionBox} from "@opendaw/studio-boxes"

export class NoteRegionImpl implements NoteRegion {
    readonly #boxGraph: BoxGraph
    readonly #region: NoteRegionBox

    constructor(boxGraph: BoxGraph, region: NoteRegionBox) {
        this.#boxGraph = boxGraph
        this.#region = region
    }

    createNoteEvent({position, duration, pitch, velocity}: NoteEventParams): void {
        this.#boxGraph.beginTransaction()
        this.#region.events.targetVertex.ifSome(({box}) => {
            const events = asInstanceOf(box, NoteEventCollectionBox)
            NoteEventBox.create(this.#boxGraph, UUID.generate(), box => {
                box.position.setValue(position)
                box.duration.setValue(duration ?? PPQN.SemiQuaver)
                box.pitch.setValue(pitch)
                box.velocity.setValue(velocity ?? 1.0)
                box.events.refer(events.events)
            })
        })
        this.#boxGraph.endTransaction()
    }
}