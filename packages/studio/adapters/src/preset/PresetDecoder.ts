import {ByteArrayInput, isDefined, isInstanceOf, Option, RuntimeNotifier, UUID} from "@opendaw/lib-std"
import {BoxGraph} from "@opendaw/lib-box"
import {AudioUnitType} from "@opendaw/studio-enums"
import {AudioUnitBox, BoxIO, CaptureAudioBox, CaptureMidiBox, TrackBox} from "@opendaw/studio-boxes"
import {ProjectSkeleton} from "../project/ProjectSkeleton"
import {ProjectUtils} from "../project/ProjectUtils"
import {TrackType} from "../timeline/TrackType"
import {PresetHeader} from "./PresetHeader"

export namespace PresetDecoder {
    export const decode = (bytes: ArrayBufferLike, target: ProjectSkeleton) => {
        const header = new ByteArrayInput(bytes.slice(0, 8))
        if (header.readInt() !== PresetHeader.MAGIC_HEADER_OPEN) {
            RuntimeNotifier.info({
                headline: "Could Not Import Preset",
                message: "Invalid preset file"
            }).then()
            return
        }
        if (header.readInt() !== PresetHeader.FORMAT_VERSION) {
            RuntimeNotifier.info({
                headline: "Could Not Import Preset",
                message: "Invalid preset version"
            }).then()
            return
        }
        const sourceBoxGraph = new BoxGraph<BoxIO.TypeMap>(Option.wrap(BoxIO.create))
        try {
            sourceBoxGraph.fromArrayBuffer(bytes.slice(8))
        } catch (reason) {
            RuntimeNotifier.info({
                headline: "Could Not Import Preset",
                message: String(reason)
            }).then()
            return
        }
        const sourceAudioUnitBoxes = sourceBoxGraph.boxes()
            .filter(box => isInstanceOf(box, AudioUnitBox))
            .filter(box => box.type.getValue() !== AudioUnitType.Output)
        ProjectUtils.extractAudioUnits(sourceAudioUnitBoxes, target, {excludeTimeline: true})
            .filter(box => box.type.getValue() !== AudioUnitType.Output)
            .forEach((audioUnitBox) => {
                const inputBox = audioUnitBox.input.pointerHub.incoming().at(0)?.box
                if (isDefined(inputBox)) {
                    audioUnitBox.capture.targetVertex.ifSome(({box: captureBox}) => {
                        if (captureBox instanceof CaptureMidiBox) {
                            TrackBox.create(target.boxGraph, UUID.generate(), box => {
                                box.index.setValue(0)
                                box.type.setValue(TrackType.Notes)
                                box.target.refer(audioUnitBox)
                                box.tracks.refer(audioUnitBox.tracks)
                            })
                        } else if (captureBox instanceof CaptureAudioBox) {
                            TrackBox.create(target.boxGraph, UUID.generate(), box => {
                                box.index.setValue(0)
                                box.type.setValue(TrackType.Audio)
                                box.target.refer(audioUnitBox)
                                box.tracks.refer(audioUnitBox.tracks)
                            })
                        }
                    })
                }
            })
    }
}