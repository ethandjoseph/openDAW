import {BoxGraph} from "@opendaw/lib-box"
import {
    AudioBusBox,
    AudioUnitBox,
    BoxIO,
    BoxVisitor,
    RootBox,
    TimelineBox,
    UserInterfaceBox
} from "@opendaw/studio-boxes"
import {assert, ByteArrayInput, isInstanceOf, Option, UUID} from "@opendaw/lib-std"
import {AudioUnitType} from "@opendaw/studio-enums"
import {ProjectSkeleton} from "./ProjectSkeleton"
import {ProjectMandatoryBoxes} from "./ProjectMandatoryBoxes"

export namespace ProjectDecoder {
    export const MAGIC_HEADER_OPEN = 0x4F50454E
    export const FORMAT_VERSION = 2

    export const decode = (arrayBuffer: ArrayBufferLike): ProjectSkeleton => {
        const input = new ByteArrayInput(arrayBuffer)
        assert(input.readInt() === ProjectDecoder.MAGIC_HEADER_OPEN, "Corrupt header. Probably not an openDAW project file.")
        assert(input.readInt() === ProjectDecoder.FORMAT_VERSION, "Deprecated Format")
        const boxGraphChunkLength = input.readInt()
        const boxGraphChunk = new Int8Array(boxGraphChunkLength)
        input.readBytes(boxGraphChunk)
        const boxGraph = new BoxGraph<BoxIO.TypeMap>(Option.wrap(BoxIO.create))
        boxGraph.fromArrayBuffer(boxGraphChunk.buffer)
        return {boxGraph, mandatoryBoxes: readMandatoryBoxes(boxGraph, input)}
    }

    export const findMandatoryBoxes = (boxGraph: BoxGraph): ProjectMandatoryBoxes => {
        const boxes: Partial<ProjectMandatoryBoxes> = {}
        for (const box of boxGraph.boxes()) {
            box.accept<BoxVisitor>({
                visitRootBox: (box: RootBox) => boxes.rootBox = box,
                visitTimelineBox: (box: TimelineBox) => boxes.timelineBox = box,
                visitUserInterfaceBox: (box: UserInterfaceBox) => boxes.userInterfaceBox = box,
                visitAudioUnitBox: (box: AudioUnitBox) => {
                    if (box.type.getValue() === AudioUnitType.Output) {
                        boxes.masterAudioUnit = box
                    }
                },
                visitAudioBusBox: (box: AudioBusBox) => {
                    const output = box.output.targetVertex.unwrapOrNull()?.box
                    if (isInstanceOf(output, AudioUnitBox) && output.type.getValue() === AudioUnitType.Output) {
                        boxes.masterBusBox = box
                    }
                }
            })
        }
        assert(boxes.rootBox !== undefined, "RootBox not found")
        assert(boxes.timelineBox !== undefined, "TimelineBox not found")
        assert(boxes.userInterfaceBox !== undefined, "UserInterfaceBox not found")
        assert(boxes.masterAudioUnit !== undefined, "MasterAudioUnit not found")
        assert(boxes.masterBusBox !== undefined, "MasterBusBox not found")
        return boxes as ProjectMandatoryBoxes
    }

    const readMandatoryBoxes = (boxGraph: BoxGraph, input: ByteArrayInput): ProjectMandatoryBoxes => {
        const rootBox = boxGraph.findBox(UUID.fromDataInput(input)).unwrap("RootBox not found") as RootBox
        const userInterfaceBox = boxGraph.findBox(UUID.fromDataInput(input)).unwrap("UserInterfaceBox not found") as UserInterfaceBox
        const masterBusBox = boxGraph.findBox(UUID.fromDataInput(input)).unwrap("AudioBusBox not found") as AudioBusBox
        const masterAudioUnit = boxGraph.findBox(UUID.fromDataInput(input)).unwrap("AudioUnitBox not found") as AudioUnitBox
        const timelineBox = boxGraph.findBox(UUID.fromDataInput(input)).unwrap("TimelineBox not found") as TimelineBox
        return {rootBox, userInterfaceBox, masterBusBox, masterAudioUnit, timelineBox}
    }
}