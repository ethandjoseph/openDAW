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
import {asInstanceOf, assert, ByteArrayInput, isDefined, Option, panic, UUID} from "@opendaw/lib-std"
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
        for (const box of boxGraph.boxes()) {
            const found = box.accept<BoxVisitor<ProjectMandatoryBoxes>>({
                visitRootBox: (rootBox: RootBox) => {
                    const primaryAudioOutputUnit = asInstanceOf(rootBox.outputDevice.pointerHub.incoming().at(0)?.box, AudioUnitBox)
                    const primaryAudioBus = asInstanceOf(primaryAudioOutputUnit.input.pointerHub.incoming().at(0)?.box, AudioBusBox)
                    const timelineBox = asInstanceOf(rootBox.timeline.targetVertex.unwrap("TimelineBox not found").box, TimelineBox)
                    const userInterfaceBoxes = rootBox.users.pointerHub.incoming().map(({box}) => asInstanceOf(box, UserInterfaceBox))
                    return {
                        rootBox,
                        primaryAudioBus,
                        primaryAudioOutputUnit,
                        timelineBox,
                        userInterfaceBoxes
                    }
                }
            })
            if (isDefined(found)) {
                return found
            }
        }
        return panic("Could not find mandatory boxes")
    }

    const readMandatoryBoxes = (boxGraph: BoxGraph, input: ByteArrayInput): ProjectMandatoryBoxes => {
        const rootBox = boxGraph.findBox(UUID.fromDataInput(input)).unwrap("RootBox not found") as RootBox
        const userInterfaceBox = boxGraph.findBox(UUID.fromDataInput(input)).unwrap("UserInterfaceBox not found") as UserInterfaceBox
        const masterBusBox = boxGraph.findBox(UUID.fromDataInput(input)).unwrap("AudioBusBox not found") as AudioBusBox
        const masterAudioUnit = boxGraph.findBox(UUID.fromDataInput(input)).unwrap("AudioUnitBox not found") as AudioUnitBox
        const timelineBox = boxGraph.findBox(UUID.fromDataInput(input)).unwrap("TimelineBox not found") as TimelineBox
        return {
            rootBox,
            userInterfaceBoxes: [userInterfaceBox],
            primaryAudioBus: masterBusBox,
            primaryAudioOutputUnit: masterAudioUnit,
            timelineBox
        }
    }
}