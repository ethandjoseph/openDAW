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
import {asInstanceOf, assert, ByteArrayInput, isDefined, Maybe, Option, panic} from "@opendaw/lib-std"
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
        return {boxGraph, mandatoryBoxes: findMandatoryBoxes(boxGraph)}
    }

    export const findMandatoryBoxes = (boxGraph: BoxGraph): ProjectMandatoryBoxes => {
        const rootBox: Maybe<RootBox> = boxGraph.boxes().find(box =>
            box.accept<BoxVisitor<boolean>>({visitRootBox: () => true})) as Maybe<RootBox>
        if (isDefined(rootBox)) {
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
        return panic("Could not find mandatory boxes")
    }
}