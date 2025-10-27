import {ppqn} from "@opendaw/lib-dsp"
import {AnyRegionBox} from "@opendaw/studio-adapters"
import {Project} from "./Project"
import {Arrays, asInstanceOf, assert, ByteArrayInput, isInstanceOf, Option, Predicate, UUID} from "@opendaw/lib-std"
import {
    AudioFileBox,
    AudioUnitBox,
    AuxSendBox,
    BoxIO,
    SelectionBox,
    SoundfontFileBox,
    TrackBox
} from "@opendaw/studio-boxes"
import {Address, Box, IndexedBox, PointerField} from "@opendaw/lib-box"

export namespace ProjectUtils {
    export const moveRegions = (regionBoxes: ReadonlyArray<AnyRegionBox>,
                                targetProject: Project,
                                offset: ppqn = 0.0): void => {
        assert(Arrays.satisfy(regionBoxes, ({graph: a}, {graph: b}) => a === b), "Region smust be from the same BoxGraph")

        const compareIndex = (a: IndexedBox, b: IndexedBox) => a.index.getValue() - b.index.getValue()
        const uuidMap = UUID.newSet<{ source: UUID.Bytes, target: UUID.Bytes }>(({source}) => source)

        const trackBoxSet = new Set<TrackBox>()
        const audioUnitBoxSet = new Set<AudioUnitBox>()

        // Collect AudioUnits and Tracks
        regionBoxes.forEach(regionBox => {
            const trackBox = asInstanceOf(regionBox.regions.targetVertex.unwrap().box, TrackBox)
            trackBoxSet.add(trackBox)
            const audioUnitBox = asInstanceOf(trackBox.tracks.targetVertex.unwrap().box, AudioUnitBox)
            audioUnitBoxSet.add(audioUnitBox)
            console.debug(regionBox, trackBox)
        })

        console.debug(`Found ${audioUnitBoxSet.size} audioUnits`)
        console.debug(`Found ${trackBoxSet.size} tracks`)

        const audioUnitBoxes = [...audioUnitBoxSet]
        const {boxGraph, masterBusBox, masterAudioUnit, rootBox} = targetProject

        const dependencies = audioUnitBoxes
            .flatMap(box => {
                const excludeBox: Predicate<Box> = box => isInstanceOf(box, TrackBox) && !trackBoxSet.has(box)
                return Array.from(box.graph.dependenciesOf(box, excludeBox).boxes)
            })
            .filter(box => box.name !== SelectionBox.ClassName && box.name !== AuxSendBox.ClassName)

        uuidMap.addMany([
            ...audioUnitBoxes
                .filter(({output: {targetAddress}}) => targetAddress.nonEmpty())
                .map(box => ({
                    source: box.output.targetAddress.unwrap().uuid,
                    target: masterBusBox.address.uuid
                })),
            ...audioUnitBoxes
                .map(box => ({
                    source: box.collection.targetAddress.unwrap("AudioUnitBox was not connected to a RootBox").uuid,
                    target: rootBox.audioUnits.address.uuid
                })),
            ...audioUnitBoxes
                .map(box => ({
                    source: box.address.uuid,
                    target: UUID.generate()
                })),
            ...dependencies
                .map(({address: {uuid}, name}) =>
                    ({
                        source: uuid,
                        target: name === AudioFileBox.ClassName || name === SoundfontFileBox.ClassName
                            ? uuid
                            : UUID.generate()
                    }))
        ])
        boxGraph.beginTransaction()
        PointerField.decodeWith({
            map: (_pointer: PointerField, newAddress: Option<Address>): Option<Address> =>
                newAddress.map(address => uuidMap.opt(address.uuid).match({
                    none: () => address,
                    some: ({target}) => address.moveTo(target)
                }))
        }, () => {
            audioUnitBoxes
                .toSorted(compareIndex)
                .forEach((source: AudioUnitBox, index) => {
                    const input = new ByteArrayInput(source.toArrayBuffer())
                    const key = source.name as keyof BoxIO.TypeMap
                    const uuid = uuidMap.get(source.address.uuid).target
                    const copy = boxGraph.createBox(key, uuid, box => box.read(input)) as AudioUnitBox
                    copy.index.setValue(index)
                })
            masterAudioUnit.index.setValue(audioUnitBoxes.length)
            dependencies
                .forEach((source: Box) => {
                    const input = new ByteArrayInput(source.toArrayBuffer())
                    const key = source.name as keyof BoxIO.TypeMap
                    const uuid = uuidMap.get(source.address.uuid).target
                    boxGraph.createBox(key, uuid, box => box.read(input))
                })
        })
        Array.from(trackBoxSet)
            .sort(compareIndex)
            .forEach((source: TrackBox, index) => {
                const box = boxGraph
                    .findBox(uuidMap.get(source.address.uuid).target)
                    .unwrap("Target Track has not been copied")
                asInstanceOf(box, TrackBox).index.setValue(index)
            })
        boxGraph.endTransaction()
        boxGraph.verifyPointers()
    }
}