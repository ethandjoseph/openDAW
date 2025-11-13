import {ValueRegionImpl, ValueTrackImpl} from "./impl"
import {asDefined, isDefined, UUID} from "@opendaw/lib-std"
import {AudioUnitBox, TrackBox, ValueEventBox, ValueEventCollectionBox, ValueRegionBox} from "@opendaw/studio-boxes"
import {InterpolationFieldAdapter, TrackType} from "@opendaw/studio-adapters"
import {Box, BoxGraph} from "@opendaw/lib-box"
import {AnyDevice, ValueRegion} from "./Api"
import {IndexRef} from "./IndexRef"

export namespace ValueTrackWriter {
    export const write = (boxGraph: BoxGraph,
                          devices: Map<AnyDevice, Box>,
                          audioUnitBox: AudioUnitBox,
                          valueTracks: ReadonlyArray<ValueTrackImpl>,
                          indexRef: IndexRef): void => {
        const map: Map<ValueRegion, ValueEventCollectionBox> = new Map()
        valueTracks.forEach(({enabled, regions, device, parameter}: ValueTrackImpl) => {
            const box = asDefined(devices.get(device), `Could not find ${device}`)
            const field = box[parameter]
            const trackBox = TrackBox.create(boxGraph, UUID.generate(), box => {
                box.type.setValue(TrackType.Value)
                box.enabled.setValue(enabled)
                box.index.setValue(indexRef.index++)
                box.target.refer(field)
                box.tracks.refer(audioUnitBox.tracks)
            })
            regions.forEach((region: ValueRegionImpl) => {
                const {
                    position, duration, loopDuration, loopOffset, events, hue, label, mute, mirror
                } = region
                const valueEventCollectionBox = isDefined(mirror)
                    ? asDefined(map.get(mirror), "mirror region not found in map")
                    : ValueEventCollectionBox.create(boxGraph, UUID.generate())
                map.set(region, valueEventCollectionBox)
                // TODO verify that events are valid (same position needs index increment)
                events.forEach(event => {
                    const valueEvent = ValueEventBox.create(boxGraph, UUID.generate(), box => {
                        box.position.setValue(event.position)
                        box.value.setValue(event.value)
                        box.slope.setValue(NaN)
                        box.index.setValue(event.index)
                        box.events.refer(valueEventCollectionBox.events)
                    })
                    InterpolationFieldAdapter.write(valueEvent.interpolation, event.interpolation)
                })
                ValueRegionBox.create(boxGraph, UUID.generate(), box => {
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