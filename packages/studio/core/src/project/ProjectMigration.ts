import {
    AudioFileBox,
    AudioUnitBox,
    BoxVisitor,
    CaptureAudioBox,
    CaptureMidiBox,
    GrooveShuffleBox,
    MIDIOutputBox,
    MIDIOutputDeviceBox,
    RevampDeviceBox,
    ValueEventBox,
    ValueEventCurveBox,
    VaporisateurDeviceBox,
    ZeitgeistDeviceBox
} from "@opendaw/studio-boxes"
import {asDefined, asInstanceOf, clamp, Float, UUID} from "@opendaw/lib-std"
import {AudioUnitType} from "@opendaw/studio-enums"
import {ProjectSkeleton} from "@opendaw/studio-adapters"
import {Field} from "@opendaw/lib-box"

const isIntEncodedAsFloat = (v: number) =>
    v > 0 && v < 1e-6 && Number.isFinite(v) && (v / 1.401298464324817e-45) % 1 === 0

export class ProjectMigration {
    static migrate({boxGraph, mandatoryBoxes}: ProjectSkeleton): void {
        const {rootBox} = mandatoryBoxes
        if (rootBox.groove.targetAddress.isEmpty()) {
            console.debug("Migrate to global GrooveShuffleBox")
            boxGraph.beginTransaction()
            rootBox.groove.refer(GrooveShuffleBox.create(boxGraph, UUID.generate()))
            boxGraph.endTransaction()
        }
        const globalShuffle = asInstanceOf(rootBox.groove.targetVertex.unwrap(), GrooveShuffleBox).label
        if (globalShuffle.getValue() !== "Groove Shuffle") {
            boxGraph.beginTransaction()
            globalShuffle.setValue("Groove Shuffle")
            boxGraph.endTransaction()
        }
        // We need to run on a copy, because we might add more boxes during the migration
        boxGraph.boxes().slice().forEach(box => box.accept<BoxVisitor>({
            visitAudioFileBox: (box: AudioFileBox): void => {
                const {startInSeconds, endInSeconds} = box
                if (isIntEncodedAsFloat(startInSeconds.getValue()) || isIntEncodedAsFloat(endInSeconds.getValue())) {
                    console.debug("Migrate 'AudioFileBox' to float")
                    boxGraph.beginTransaction()
                    startInSeconds.setValue(Float.floatToIntBits(startInSeconds.getValue()))
                    endInSeconds.setValue(Float.floatToIntBits(endInSeconds.getValue()))
                    boxGraph.endTransaction()
                }
            },
            visitMIDIOutputDeviceBox: (deviceBox: MIDIOutputDeviceBox): void => {
                const id = deviceBox.deprecatedDevice.id.getValue()
                const label = deviceBox.deprecatedDevice.label.getValue()
                const delay = deviceBox.deprecatedDelay.getValue()
                if (id !== "") {
                    console.debug("Migrate 'MIDIOutputDeviceBox' to MIDIOutputBox")
                    boxGraph.beginTransaction()
                    deviceBox.device.refer(
                        MIDIOutputBox.create(boxGraph, UUID.generate(), box => {
                            box.id.setValue(id)
                            box.label.setValue(label)
                            box.delayInMs.setValue(delay)
                            box.root.refer(rootBox.outputMidiDevices)
                        }).device
                    )
                    // clear all data
                    deviceBox.deprecatedDevice.id.setValue("")
                    deviceBox.deprecatedDevice.label.setValue("")
                    boxGraph.endTransaction()
                }
            },
            visitZeitgeistDeviceBox: (box: ZeitgeistDeviceBox) => {
                if (box.groove.targetAddress.isEmpty()) {
                    console.debug("Migrate 'ZeitgeistDeviceBox' to GrooveShuffleBox")
                    boxGraph.beginTransaction()
                    box.groove.refer(rootBox.groove.targetVertex.unwrap())
                    boxGraph.endTransaction()
                }
            },
            visitValueEventBox: (eventBox: ValueEventBox) => {
                const slope = eventBox.slope.getValue()
                if (isNaN(slope)) {return} // already migrated, nothing to do
                if (slope === 0.0) { // never set
                    console.debug("Migrate 'ValueEventBox'")
                    boxGraph.beginTransaction()
                    eventBox.slope.setValue(NaN)
                    boxGraph.endTransaction()
                } else if (eventBox.interpolation.getValue() === 1) { // linear
                    if (slope === 0.5) {
                        console.debug("Migrate 'ValueEventBox' to linear")
                        boxGraph.beginTransaction()
                        eventBox.slope.setValue(NaN)
                        boxGraph.endTransaction()
                    } else {
                        console.debug("Migrate 'ValueEventBox' to new ValueEventCurveBox")
                        boxGraph.beginTransaction()
                        ValueEventCurveBox.create(boxGraph, UUID.generate(), box => {
                            box.event.refer(eventBox.interpolation)
                            box.slope.setValue(slope)
                        })
                        eventBox.slope.setValue(NaN)
                        boxGraph.endTransaction()
                    }
                }
            },
            visitAudioUnitBox: (box: AudioUnitBox): void => {
                if (box.type.getValue() !== AudioUnitType.Instrument || box.capture.nonEmpty()) {
                    return
                }
                boxGraph.beginTransaction()
                const captureBox = asDefined(box.input.pointerHub.incoming().at(0)?.box
                    .accept<BoxVisitor<CaptureAudioBox | CaptureMidiBox>>({
                        visitVaporisateurDeviceBox: () => CaptureMidiBox.create(boxGraph, UUID.generate()),
                        visitNanoDeviceBox: () => CaptureMidiBox.create(boxGraph, UUID.generate()),
                        visitPlayfieldDeviceBox: () => CaptureMidiBox.create(boxGraph, UUID.generate()),
                        visitTapeDeviceBox: () => CaptureAudioBox.create(boxGraph, UUID.generate())
                    }))
                box.capture.refer(captureBox)
                boxGraph.endTransaction()
            },
            visitRevampDeviceBox: (box: RevampDeviceBox): void => {
                // Clamp order in RevampDeviceBox to 0-3
                // The older version stored the actual order,
                // but the new version only stores indices, so 4 is not valid anymore
                boxGraph.beginTransaction()
                box.lowPass.order.setValue(clamp(box.lowPass.order.getValue(), 0, 3))
                box.highPass.order.setValue(clamp(box.highPass.order.getValue(), 0, 3))
                boxGraph.endTransaction()
            },
            visitVaporisateurDeviceBox: (box: VaporisateurDeviceBox): void => {
                if (box.version.getValue() === 0) {
                    console.debug("Migrate 'VaporisateurDeviceBox to zero db")
                    boxGraph.beginTransaction()
                    box.volume.setValue(box.volume.getValue() - 15.0)
                    box.version.setValue(1)
                    boxGraph.endTransaction()
                }
                if (box.version.getValue() === 1) {
                    console.debug("Migrate 'VaporisateurDeviceBox to extended osc")
                    boxGraph.beginTransaction()
                    const [oscA, oscB] = box.oscillators.fields()
                    const movePointers = (oldTarget: Field, newTarget: Field) => {
                        oldTarget.pointerHub.incoming().forEach((pointer) => pointer.refer(newTarget))
                    }
                    movePointers(box.waveform, oscA.waveform)
                    movePointers(box.octave, oscA.octave)
                    movePointers(box.tune, oscA.tune)
                    movePointers(box.volume, oscA.volume)
                    oscA.waveform.setValue(box.waveform.getValue())
                    oscA.octave.setValue(box.octave.getValue())
                    oscA.tune.setValue(box.tune.getValue())
                    oscA.volume.setValue(box.volume.getValue())
                    oscB.volume.setValue(Number.NEGATIVE_INFINITY)
                    box.version.setValue(2)
                    boxGraph.endTransaction()
                }
            }
        }))
    }
}