import {NoteRegionImpl, NoteTrackImpl} from "./impl"
import {asDefined, isDefined, Provider, UUID} from "@opendaw/lib-std"
import {AudioUnitBox, NoteEventBox, NoteEventCollectionBox, NoteRegionBox, TrackBox} from "@opendaw/studio-boxes"
import {TrackType} from "@opendaw/studio-adapters"
import {BoxGraph} from "@opendaw/lib-box"
import {NoteRegion} from "./Api"

export class NoteTrackWriter {
    readonly #boxGraph: BoxGraph
    readonly #nextTrackIndex: Provider<int>

    readonly #map: Map<NoteRegion, NoteEventCollectionBox> = new Map()

    constructor(boxGraph: BoxGraph, nextTrackIndex: Provider<int>) {
        this.#boxGraph = boxGraph
        this.#nextTrackIndex = nextTrackIndex
    }

    write(audioUnitBox: AudioUnitBox, noteTracks: ReadonlyArray<NoteTrackImpl>): void {
        noteTracks.forEach(({enabled, regions}: NoteTrackImpl) => {
            const trackBox = TrackBox.create(this.#boxGraph, UUID.generate(), box => {
                box.type.setValue(TrackType.Notes)
                box.enabled.setValue(enabled)
                box.index.setValue(this.#nextTrackIndex())
                box.target.refer(audioUnitBox)
                box.tracks.refer(audioUnitBox.tracks)
            })
            regions.forEach((region: NoteRegionImpl) => {
                const {
                    position, duration, loopDuration, loopOffset, events, hue, label, mute, mirror
                } = region
                const noteEventCollectionBox = isDefined(mirror)
                    ? asDefined(this.#map.get(mirror), "mirror region not found in map")
                    : NoteEventCollectionBox.create(this.#boxGraph, UUID.generate())
                this.#map.set(region, noteEventCollectionBox)
                events.forEach(event => {
                    NoteEventBox.create(this.#boxGraph, UUID.generate(), box => {
                        box.position.setValue(event.position)
                        box.duration.setValue(event.duration)
                        box.pitch.setValue(event.pitch)
                        box.cent.setValue(event.cents) // TODO rename to plural
                        box.velocity.setValue(event.velocity)
                        box.events.refer(noteEventCollectionBox.events)
                    })
                })
                NoteRegionBox.create(this.#boxGraph, UUID.generate(), box => {
                    box.position.setValue(position)
                    box.duration.setValue(duration)
                    box.loopDuration.setValue(loopDuration)
                    box.loopOffset.setValue(loopOffset)
                    box.hue.setValue(hue)
                    box.label.setValue(label)
                    box.mute.setValue(mute)
                    box.regions.refer(trackBox.regions)
                    box.events.refer(noteEventCollectionBox.owners)
                })
            })
        })
    }
}