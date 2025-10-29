import {Lifecycle, ObservableValue, Strings} from "@opendaw/lib-std"
import {createElement, Inject} from "@opendaw/lib-jsx"
import {MenuButton} from "@/ui/components/MenuButton"
import {MenuItem} from "@/ui/model/menu-item"
import {Colors, MidiDevices, Project} from "@opendaw/studio-core"
import {MIDIOutputDeviceBoxAdapter} from "@opendaw/studio-adapters"

type Construct = {
    lifecycle: Lifecycle
    project: Project
    adapter: MIDIOutputDeviceBoxAdapter
}

export const DeviceSelector = ({lifecycle, project, adapter}: Construct) => {
    const deviceLabelClass = Inject.classList("device-label")
    const deviceIdObserver = (owner: ObservableValue<string>) => {
        const requestedId = owner.getValue()
        const optDevice = MidiDevices.externalOutputDevices()
            .map(devices => devices.find(device => device.id === requestedId))
        deviceLabelClass.toggle("not-available", optDevice.isEmpty() && requestedId !== "")
    }
    return (
        <MenuButton root={MenuItem.root().setRuntimeChildrenProcedure(parent =>
            parent.addMenuItem(...MidiDevices.externalOutputDevices().match({
                none: () => [MenuItem.default({
                    label: "No MIDI requested.",
                    selectable: false
                })],
                some: outputs => outputs.length === 0
                    ? [MenuItem.default({
                        label: "No device found.",
                        selectable: false
                    })]
                    : outputs.map(output => MenuItem.default({
                        label: output.name ?? "Unnamed device"
                    }).setTriggerProcedure(() => {
                        project.editing.modify(() => {
                            adapter.box.device.id.setValue(output.id)
                            adapter.box.device.label.setValue(output.name ?? "Unnamed device")
                        })
                        // updating UI if id was the same
                        deviceIdObserver(adapter.box.device.id)
                    }))
            })))}
                    style={{width: "100%"}}
                    appearance={{
                        color: Colors.dark,
                        activeColor: Colors.gray
                    }}>
            <div className={deviceLabelClass}
                 onInit={element => {
                     lifecycle.ownAll(
                         adapter.box.device.id.catchupAndSubscribe(deviceIdObserver),
                         adapter.box.device.label.catchupAndSubscribe(owner =>
                             element.textContent = Strings.nonEmpty(
                                 owner.getValue(), "No device selected"))
                     )
                 }}/>
        </MenuButton>
    )
}