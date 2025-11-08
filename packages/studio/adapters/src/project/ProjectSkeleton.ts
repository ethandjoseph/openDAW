import {BoxGraph} from "@opendaw/lib-box"
import {
    AudioBusBox,
    AudioUnitBox,
    BoxIO,
    CompressorDeviceBox,
    GrooveShuffleBox,
    RootBox,
    TimelineBox,
    UserInterfaceBox
} from "@opendaw/studio-boxes"
import {ProjectMandatoryBoxes} from "../index"
import {Option, UUID} from "@opendaw/lib-std"
import {AudioUnitType, IconSymbol} from "@opendaw/studio-enums"

export type ProjectSkeleton = {
    boxGraph: BoxGraph<BoxIO.TypeMap>,
    mandatoryBoxes: ProjectMandatoryBoxes
}

export namespace ProjectSkeleton {
    export const empty = (options: {
        createOutputCompressor: boolean,
        createDefaultUser: boolean
    }): ProjectSkeleton => {
        const boxGraph = new BoxGraph<BoxIO.TypeMap>(Option.wrap(BoxIO.create))
        const isoString = new Date().toISOString()
        console.debug(`New Project created on ${isoString}`)
        boxGraph.beginTransaction()
        const grooveShuffleBox = GrooveShuffleBox.create(boxGraph, UUID.generate(), box => {
            box.label.setValue("Groove Shuffle")
        })
        const rootBox = RootBox.create(boxGraph, UUID.generate(), box => {
            box.groove.refer(grooveShuffleBox)
            box.created.setValue(isoString)
        })
        const primaryAudioBus = AudioBusBox.create(boxGraph, UUID.generate(), box => {
            box.collection.refer(rootBox.audioBusses)
            box.label.setValue("Output")
            box.icon.setValue(IconSymbol.toName(IconSymbol.SpeakerHeadphone))
            box.color.setValue(/*Colors.blue*/ "hsl(189, 100%, 65%)") // TODO
        })
        const primaryAudioOutputUnit = AudioUnitBox.create(boxGraph, UUID.generate(), box => {
            box.type.setValue(AudioUnitType.Output)
            box.collection.refer(rootBox.audioUnits)
            box.output.refer(rootBox.outputDevice)
            box.index.setValue(0)
        })
        if (options.createOutputCompressor) {
            CompressorDeviceBox.create(boxGraph, UUID.generate(), box => {
                box.label.setValue("Compressor")
                box.index.setValue(0)
                box.host.refer(primaryAudioOutputUnit.audioEffects)
                box.threshold.setValue(0)
                box.ratio.setValue(24)
            })
        }
        const timelineBox = TimelineBox.create(boxGraph, UUID.generate())
        rootBox.timeline.refer(timelineBox.root)
        primaryAudioBus.output.refer(primaryAudioOutputUnit.input)
        const userInterfaceBoxes: Array<UserInterfaceBox> = []
        if (options.createDefaultUser) {
            const userInterfaceBox = UserInterfaceBox.create(boxGraph, UUID.generate())
            userInterfaceBox.root.refer(rootBox.users)
            userInterfaceBoxes.push(userInterfaceBox)
        }
        boxGraph.endTransaction()
        return {
            boxGraph,
            mandatoryBoxes: {
                rootBox,
                primaryAudioBus,
                primaryAudioOutputUnit,
                timelineBox,
                userInterfaceBoxes
            }
        }
    }
}
