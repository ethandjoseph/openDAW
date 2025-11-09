import {AudioUnitType} from "@opendaw/studio-enums"
import {int, Option, UUID} from "@opendaw/lib-std"
import {IndexedBox} from "@opendaw/lib-box"
import {AudioUnitBox, RootBox} from "@opendaw/studio-boxes"
import {AudioUnitOrdering} from "./AudioUnitOrdering"
import {CaptureBox} from "../CaptureBox"
import {ProjectSkeleton} from "../project/ProjectSkeleton"

export namespace AudioUnitFactory {
    export const create = ({boxGraph, mandatoryBoxes: {rootBox, primaryAudioBus}}: ProjectSkeleton,
                                    type: AudioUnitType,
                                    capture: Option<CaptureBox>, index?: int): AudioUnitBox => {
        const insertIndex = index ?? AudioUnitFactory.orderAndGetIndex(rootBox, type)
        console.debug(`createAudioUnit type: ${type}, insertIndex: ${insertIndex}`)
        return AudioUnitBox.create(boxGraph, UUID.generate(), box => {
            box.collection.refer(rootBox.audioUnits)
            box.output.refer(primaryAudioBus.input)
            box.index.setValue(insertIndex)
            box.type.setValue(type)
            capture.ifSome(capture => box.capture.refer(capture))
        })
    }

    export const orderAndGetIndex = (rootBox: RootBox, type: AudioUnitType): int => {
        const boxes = IndexedBox.collectIndexedBoxes(rootBox.audioUnits, AudioUnitBox)
        const order: int = AudioUnitOrdering[type]
        let index = 0 | 0
        for (; index < boxes.length; index++) {
            if (AudioUnitOrdering[boxes[index].type.getValue()] > order) {break}
        }
        const insertIndex = index
        while (index < boxes.length) {
            boxes[index].index.setValue(++index)
        }
        return insertIndex
    }
}