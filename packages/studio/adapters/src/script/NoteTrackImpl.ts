import {UUID} from "@opendaw/lib-std"
import {NoteEventCollectionBox, NoteRegionBox, TrackBox} from "@opendaw/studio-boxes"
import {NoteRegion, NoteRegionParams, NoteTrack} from "./Api"
import {ProjectSkeleton} from "../project/ProjectSkeleton"
import {ColorCodes} from "../factories/ColorCodes"
import {NoteRegionImpl} from "./NoteRegionImpl"

export class NoteTrackImpl implements NoteTrack {
    readonly #skeleton: ProjectSkeleton
    readonly #trackBox: TrackBox

    constructor(skeleton: ProjectSkeleton, trackBox: TrackBox) {
        this.#skeleton = skeleton
        this.#trackBox = trackBox
    }

    createNoteRegion({
                         position, duration,
                         loopOffset, loopDuration, eventOffset,
                         mute, name, hue
                     }: NoteRegionParams): NoteRegion {
        const {boxGraph} = this.#skeleton
        boxGraph.beginTransaction()
        const events = NoteEventCollectionBox.create(boxGraph, UUID.generate())
        const region = NoteRegionBox.create(boxGraph, UUID.generate(), box => {
            box.position.setValue(position)
            box.label.setValue(name ?? "Notes")
            box.hue.setValue(hue ?? ColorCodes.forTrackType(this.#trackBox.type.getValue()))
            box.mute.setValue(mute ?? false)
            box.duration.setValue(duration)
            box.loopDuration.setValue(loopOffset ?? 0)
            box.loopDuration.setValue(loopDuration ?? duration)
            box.eventOffset.setValue(eventOffset ?? 0)
            box.events.refer(events.owners)
            box.regions.refer(this.#trackBox.regions)
        })
        boxGraph.endTransaction()
        return new NoteRegionImpl(boxGraph, region)
    }
}