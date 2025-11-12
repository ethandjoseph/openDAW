import {ValueRegionImpl, ValueTrackImpl} from "./impl"
import {asDefined, isDefined, Provider, UUID} from "@opendaw/lib-std"
import {AudioUnitBox, TrackBox, ValueEventBox, ValueEventCollectionBox, ValueRegionBox} from "@opendaw/studio-boxes"
import {InterpolationFieldAdapter, TrackType} from "@opendaw/studio-adapters"
import {Box, BoxGraph} from "@opendaw/lib-box"
import {AnyDevice, ValueRegion} from "./Api"

export class ValueTrackWriter {
    readonly #boxGraph: BoxGraph
    readonly #devices: Map<AnyDevice, Box>
    readonly #nextTrackIndex: Provider<int>

    readonly #map: Map<ValueRegion, ValueEventCollectionBox> = new Map()

    constructor(boxGraph: BoxGraph, devices: Map<AnyDevice, Box>, nextTrackIndex: Provider<int>) {
        this.#boxGraph = boxGraph
        this.#devices = devices
        this.#nextTrackIndex = nextTrackIndex
    }

    write(audioUnitBox: AudioUnitBox, valueTracks: ReadonlyArray<ValueTrackImpl>): void {
        valueTracks.forEach(({enabled, regions, device, parameter}: ValueTrackImpl) => {
            const box = asDefined(this.#devices.get(device), `Could not find ${device}`)
            const field = box[parameter]
            const trackBox = TrackBox.create(this.#boxGraph, UUID.generate(), box => {
                box.type.setValue(TrackType.Value)
                box.enabled.setValue(enabled)
                box.index.setValue(this.#nextTrackIndex())
                box.target.refer(field)
                box.tracks.refer(audioUnitBox.tracks)
            })
            regions.forEach((region: ValueRegionImpl) => {
                const {
                    position, duration, loopDuration, loopOffset, events, hue, label, mute, mirror
                } = region
                const valueEventCollectionBox = isDefined(mirror)
                    ? asDefined(this.#map.get(mirror), "mirror region not found in map")
                    : ValueEventCollectionBox.create(this.#boxGraph, UUID.generate())
                this.#map.set(region, valueEventCollectionBox)
                // TODO verify that events are valid (same position needs index increment)
                events.forEach(event => {
                    const valueEvent = ValueEventBox.create(this.#boxGraph, UUID.generate(), box => {
                        box.position.setValue(event.position)
                        box.value.setValue(event.value)
                        box.index.setValue(event.index)
                        box.events.refer(valueEventCollectionBox.events)
                    })
                    InterpolationFieldAdapter.write(valueEvent.interpolation, event.interpolation)
                })
                ValueRegionBox.create(this.#boxGraph, UUID.generate(), box => {
                    box.position.setValue(position)
                    box.duration.setValue(duration)
                    box.loopDuration.setValue(loopDuration)
                    box.loopOffset.setValue(loopOffset)
                    box.hue.setValue(hue)
                    box.label.setValue(label)
                    box.mute.setValue(mute)
                    box.regions.refer(trackBox.regions)
                    box.events.refer(valueEventCollectionBox.owners)
                })
            })
        })
    }
}