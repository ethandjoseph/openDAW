import {asDefined, panic, Terminable, UUID} from "@opendaw/lib-std"
import {DragAndDrop} from "@/ui/DragAndDrop"
import {AnyDragData} from "@/ui/AnyDragData"
import {AudioUnitBoxAdapter, Devices} from "@opendaw/studio-adapters"
import {InsertMarker} from "@/ui/components/InsertMarker"
import {EffectFactories, InstrumentBox, InstrumentFactories, InstrumentFactory, Project} from "@opendaw/studio-core"
import {IndexedBox} from "@opendaw/lib-box"
import {BoxVisitor, CaptureAudioBox, CaptureMidiBox} from "@opendaw/studio-boxes"

export namespace DevicePanelDragAndDrop {
    export const install = (project: Project,
                            editors: HTMLElement,
                            midiEffectsContainer: HTMLElement,
                            instrumentContainer: HTMLElement,
                            audioEffectsContainer: HTMLElement): Terminable => {
        const insertMarker: HTMLElement = InsertMarker()
        const {editing, boxGraph, boxAdapters, userEditingManager} = project
        return DragAndDrop.installTarget(editors, {
            drag: (event: DragEvent, dragData: AnyDragData): boolean => {
                instrumentContainer.style.opacity = "1.0"
                const editingDeviceChain = userEditingManager.audioUnit.get()
                if (editingDeviceChain.isEmpty()) {return false}
                const deviceHost = boxAdapters.adapterFor(editingDeviceChain.unwrap().box, Devices.isHost)
                const {type} = dragData
                let container: HTMLElement
                if (type === "audio-effect") {
                    container = audioEffectsContainer
                } else if (type === "midi-effect") {
                    if (deviceHost.inputAdapter.mapOr(input => input.accepts !== "midi", true)) {return false}
                    container = midiEffectsContainer
                } else if (type === "instrument" && deviceHost.isAudioUnit) {
                    instrumentContainer.style.opacity = "0.5"
                    return true
                } else {
                    return false
                }
                const [index, successor] = DragAndDrop.findInsertLocation(event, container)
                if (dragData.start_index === null) {
                    container.insertBefore(insertMarker, successor)
                } else {
                    const delta = index - dragData.start_index
                    if (delta < 0 || delta > 1) {
                        container.insertBefore(insertMarker, successor)
                    } else if (insertMarker.isConnected) {insertMarker.remove()}
                }
                return true
            },
            drop: (event: DragEvent, dragData: AnyDragData): void => {
                instrumentContainer.style.opacity = "1.0"
                if (insertMarker.isConnected) {insertMarker.remove()}
                const {type} = dragData
                if (type !== "midi-effect" && type !== "audio-effect" && type !== "instrument") {return}
                const editingDeviceChain = userEditingManager.audioUnit.get()
                if (editingDeviceChain.isEmpty()) {return}
                const deviceHost = boxAdapters.adapterFor(editingDeviceChain.unwrap().box, Devices.isHost)
                if (type === "instrument" && deviceHost instanceof AudioUnitBoxAdapter) {
                    const inputField = deviceHost.inputField
                    console.debug(`Replace '${inputField.pointerHub.incoming().at(0)?.box.name ?? "no input"} with '${dragData.device}'`)
                    editing.modify(() => {
                        inputField.pointerHub.incoming().forEach(pointer => pointer.box.delete())
                        const {create, defaultIcon, defaultName}: InstrumentFactory =
                            asDefined(InstrumentFactories.Named[dragData.device], `Unknown: '${dragData.device}'`)
                        const instrumentBox: InstrumentBox = create(boxGraph, inputField, defaultName, defaultIcon)
                        // TODO This needs to be done in a more generic way
                        const captureBox = asDefined(instrumentBox.box.accept<BoxVisitor<CaptureAudioBox | CaptureMidiBox>>({
                            visitVaporisateurDeviceBox: () => CaptureMidiBox.create(boxGraph, UUID.generate()),
                            visitNanoDeviceBox: () => CaptureMidiBox.create(boxGraph, UUID.generate()),
                            visitPlayfieldDeviceBox: () => CaptureMidiBox.create(boxGraph, UUID.generate()),
                            visitMIDIOutputDeviceBox: () => CaptureMidiBox.create(boxGraph, UUID.generate()),
                            visitSoundfontDeviceBox: () => CaptureMidiBox.create(boxGraph, UUID.generate()),
                            visitTapeDeviceBox: () => CaptureAudioBox.create(boxGraph, UUID.generate())
                        }))
                        deviceHost.box.capture.targetVertex.unwrap().box.delete()
                        deviceHost.box.capture.refer(captureBox)
                    })
                    return
                }
                let container: HTMLElement
                let field
                if (type === "audio-effect") {
                    container = audioEffectsContainer
                    field = deviceHost.audioEffects.field()
                } else if (type === "midi-effect") {
                    container = midiEffectsContainer
                    field = deviceHost.midiEffects.field()
                } else {
                    return panic(`Unknown type: ${type}`)
                }
                const [index] = DragAndDrop.findInsertLocation(event, container)
                if (dragData.start_index === null) {
                    editing.modify(() => {
                        const factory = EffectFactories.MergedNamed[dragData.device]
                        project.api.insertEffect(field, factory, index)
                    })
                } else {
                    const delta = index - dragData.start_index
                    if (delta < 0 || delta > 1) { // if delta is zero or one, it has no effect on the order
                        editing.modify(() => IndexedBox.moveIndex(field, dragData.start_index, delta))
                    }
                }
            },
            enter: () => {},
            leave: () => {
                instrumentContainer.style.opacity = "1.0"
                if (insertMarker.isConnected) {insertMarker.remove()}
            }
        })
    }
}