import {ppqn} from "@opendaw/lib-dsp"
import {AnyRegionBox, UnionBoxTypes} from "@opendaw/studio-adapters"
import {Project} from "./Project"
import {
    Arrays,
    asInstanceOf,
    assert,
    ByteArrayInput,
    int,
    isInstanceOf,
    Option,
    Predicate,
    SetMultimap,
    SortedSet,
    UUID
} from "@opendaw/lib-std"
import {
    AudioFileBox,
    AudioUnitBox,
    AuxSendBox,
    BoxIO,
    RootBox,
    SelectionBox,
    SoundfontFileBox,
    TrackBox
} from "@opendaw/studio-boxes"
import {Address, Box, BoxGraph, IndexedBox, PointerField} from "@opendaw/lib-box"
import {AudioUnitOrdering} from "../AudioUnitOrdering"

export namespace ProjectUtils {
    type UUIDMapper = { source: UUID.Bytes, target: UUID.Bytes }

    const isSameGraph: (a: Box, b: Box) => boolean = ({graph: a}, {graph: b}) => a === b
    const compareIndex = (a: IndexedBox, b: IndexedBox) => a.index.getValue() - b.index.getValue()

    export const extractAudioUnits = (audioUnitBoxes: ReadonlyArray<AudioUnitBox>,
                                      targetProject: Project,
                                      options: { includeAux?: boolean, includeBus?: boolean } = {}): void => {
        assert(Arrays.satisfy(audioUnitBoxes, isSameGraph), "AudioUnits must share the same BoxGraph")
        // TODO Implement include options.
        assert(!options.includeAux && !options.includeBus, "Options are not yet implemented")
        const {boxGraph, masterBusBox, rootBox} = targetProject
        const dependencies = audioUnitBoxes
            .flatMap(box => Array.from(box.graph.dependenciesOf(box, {alwaysFollowMandatory: true}).boxes))
            .filter(box => box.name !== SelectionBox.ClassName && box.name !== AuxSendBox.ClassName)
        const uuidMap = generateTransferMap(
            audioUnitBoxes, dependencies, rootBox.audioUnits.address.uuid, masterBusBox.address.uuid)
        boxGraph.beginTransaction()
        copy(uuidMap, boxGraph, audioUnitBoxes, dependencies)
        reorderAudioUnits(uuidMap, audioUnitBoxes, rootBox)
        boxGraph.endTransaction()
        boxGraph.verifyPointers()
    }

    export const extractRegions = (regionBoxes: ReadonlyArray<AnyRegionBox>,
                                   targetProject: Project,
                                   insertPosition: ppqn = 0.0): void => {
        assert(Arrays.satisfy(regionBoxes, isSameGraph),
            "Region smust be from the same BoxGraph")
        const regionBoxSet = new Set<AnyRegionBox>(regionBoxes)
        const trackBoxSet = new Set<TrackBox>()
        const audioUnitBoxSet = new SetMultimap<AudioUnitBox, TrackBox>()
        // Collect AudioUnits and Tracks
        regionBoxes.forEach(regionBox => {
            const trackBox = asInstanceOf(regionBox.regions.targetVertex.unwrap().box, TrackBox)
            trackBoxSet.add(trackBox)
            const audioUnitBox = asInstanceOf(trackBox.tracks.targetVertex.unwrap().box, AudioUnitBox)
            audioUnitBoxSet.add(audioUnitBox, trackBox)
        })
        console.debug(`Found ${audioUnitBoxSet.keyCount()} audioUnits`)
        console.debug(`Found ${trackBoxSet.size} tracks`)
        const audioUnitBoxes = [...audioUnitBoxSet.keys()]
        const {boxGraph, masterBusBox, rootBox} = targetProject
        const excludeBox: Predicate<Box> =
            box => (isInstanceOf(box, TrackBox) && !trackBoxSet.has(box))
                || (UnionBoxTypes.isRegionBox(box) && !regionBoxSet.has(box))
        const dependencies = audioUnitBoxes
            .flatMap(box => Array.from(box.graph.dependenciesOf(box, {excludeBox, alwaysFollowMandatory: true}).boxes))
            .filter(box => box.name !== SelectionBox.ClassName && box.name !== AuxSendBox.ClassName)
        const uuidMap = generateTransferMap(
            audioUnitBoxes, dependencies, rootBox.audioUnits.address.uuid, masterBusBox.address.uuid)
        boxGraph.beginTransaction()
        copy(uuidMap, boxGraph, audioUnitBoxes, dependencies)
        reorderAudioUnits(uuidMap, audioUnitBoxes, rootBox)
        // reorder track indices
        audioUnitBoxSet.forEach((_, trackBoxes) => [...trackBoxes]
            .sort(compareIndex)
            .forEach((source: TrackBox, index) => {
                const box = boxGraph
                    .findBox(uuidMap.get(source.address.uuid).target)
                    .unwrap("Target Track has not been copied")
                asInstanceOf(box, TrackBox).index.setValue(index)
            }))
        // move new regions to the target position
        const minPosition = regionBoxes.reduce((min, region) =>
            Math.min(min, region.position.getValue()), Number.MAX_VALUE)
        const delta = insertPosition - minPosition
        regionBoxes.forEach((source: AnyRegionBox) => {
            const box = boxGraph
                .findBox(uuidMap.get(source.address.uuid).target)
                .unwrap("Target Track has not been copied")
            const position = UnionBoxTypes.asRegionBox(box).position
            position.setValue(position.getValue() + delta)
        })
        boxGraph.endTransaction()
        boxGraph.verifyPointers()
    }

    const generateTransferMap = (audioUnitBoxes: ReadonlyArray<AudioUnitBox>,
                                 dependencies: ReadonlyArray<Box>,
                                 rootBoxUUID: UUID.Bytes,
                                 masterBusBoxUUID: UUID.Bytes): SortedSet<UUID.Bytes, UUIDMapper> => {
        const uuidMap = UUID.newSet<UUIDMapper>(({source}) => source)
        uuidMap.addMany([
            ...audioUnitBoxes
                .filter(({output: {targetAddress}}) => targetAddress.nonEmpty())
                .map(box => ({
                    source: box.output.targetAddress.unwrap().uuid,
                    target: masterBusBoxUUID
                })),
            ...audioUnitBoxes
                .map(box => ({
                    source: box.collection.targetAddress.unwrap("AudioUnitBox was not connected to a RootBox").uuid,
                    target: rootBoxUUID
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
        return uuidMap
    }

    const copy = (uuidMap: SortedSet<UUID.Bytes, UUIDMapper>,
                  boxGraph: BoxGraph,
                  audioUnitBoxes: ReadonlyArray<AudioUnitBox>,
                  dependencies: ReadonlyArray<Box>) => {
        PointerField.decodeWith({
            map: (_pointer: PointerField, newAddress: Option<Address>): Option<Address> =>
                newAddress.map(address => uuidMap.opt(address.uuid).match({
                    none: () => address,
                    some: ({target}) => address.moveTo(target)
                }))
        }, () => {
            audioUnitBoxes
                .forEach((source: AudioUnitBox) => {
                    const input = new ByteArrayInput(source.toArrayBuffer())
                    const key = source.name as keyof BoxIO.TypeMap
                    const uuid = uuidMap.get(source.address.uuid).target
                    boxGraph.createBox(key, uuid, box => box.read(input))
                })
            dependencies
                .forEach((source: Box) => {
                    const input = new ByteArrayInput(source.toArrayBuffer())
                    const key = source.name as keyof BoxIO.TypeMap
                    const uuid = uuidMap.get(source.address.uuid).target
                    if (source instanceof AudioFileBox || source instanceof SoundfontFileBox) {
                        // Those boxes keep their UUID. So if they are already in the graph, we can just read them.
                        if (boxGraph.findBox(source.address.uuid).nonEmpty()) {
                            source.read(input)
                            return
                        }
                    }
                    boxGraph.createBox(key, uuid, box => box.read(input))
                })
        })
    }

    const reorderAudioUnits = (uuidMap: SortedSet<UUID.Bytes, UUIDMapper>,
                               audioUnitBoxes: ReadonlyArray<AudioUnitBox>,
                               rootBox: RootBox): void => {
        audioUnitBoxes
            .toSorted(compareIndex)
            .forEach((box: AudioUnitBox) => {
                // That is a bit slow, but we are probably not dealing with too many audioUnits at this point.
                const boxes = IndexedBox.collectIndexedBoxes(rootBox.audioUnits, AudioUnitBox)
                const order: int = AudioUnitOrdering[box.type.getValue()]
                let index = 0 | 0
                for (; index < boxes.length; index++) {
                    if (AudioUnitOrdering[boxes[index].type.getValue()] > order) {break}
                }
                const insertIndex = index
                while (index < boxes.length) {
                    boxes[index].index.setValue(++index)
                }
                asInstanceOf(rootBox.graph
                    .findBox(uuidMap.get(box.address.uuid).target)
                    .unwrap("Target Track has not been copied"), AudioUnitBox).index.setValue(insertIndex)
            })
    }
}