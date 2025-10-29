import css from "./DeviceSelector.sass?inline"
import {asInstanceOf, clamp, DefaultObservableValue, int, Lifecycle, Strings, Terminator, UUID} from "@opendaw/lib-std"
import {createElement, Inject} from "@opendaw/lib-jsx"
import {MenuButton} from "@/ui/components/MenuButton"
import {MenuItem} from "@/ui/model/menu-item"
import {Colors, MidiDevices, Project} from "@opendaw/studio-core"
import {MIDIOutputDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {MIDIOutputBox, RootBox} from "@opendaw/studio-boxes"
import {Html} from "@opendaw/lib-dom"
import {NumberInput} from "@/ui/components/NumberInput"

const className = Html.adoptStyleSheet(css, "DeviceSelector")

type Construct = {
    lifecycle: Lifecycle
    project: Project
    adapter: MIDIOutputDeviceBoxAdapter
}

const getOrCreateMIDIOutput = (rootBox: RootBox, output: MIDIOutput): MIDIOutputBox => {
    return rootBox.outputMidiDevice.pointerHub
            .incoming()
            .map(({box}) => asInstanceOf(box, MIDIOutputBox))
            .find((box) => box.id.getValue() === output.id)
        ?? MIDIOutputBox.create(rootBox.graph, UUID.generate(), box => {
            box.id.setValue(output.id)
            box.label.setValue(output.name ?? "Unnamed")
            box.root.refer(rootBox.outputMidiDevice)
        })
}

export const DeviceSelector = ({lifecycle, project, adapter}: Construct) => {
    const {editing, rootBox} = project
    const deviceLabelClass = Inject.classList("device-label")
    const deviceIdObserver = (requestedId: string) => {
        const optDevice = MidiDevices.externalOutputDevices()
            .map(devices => devices.find(device => device.id === requestedId))
        deviceLabelClass.toggle("not-available", optDevice.isEmpty() && requestedId !== "")
    }
    const delayInMs = lifecycle.own(new DefaultObservableValue<int>(0))
    const delaySubscription = lifecycle.own(new Terminator())
    lifecycle.ownAll(
        adapter.midiDevice.catchupAndSubscribe(opt => {
            delaySubscription.terminate()
            opt.match({
                none: () => delayInMs.setValue(0),
                some: device => delaySubscription.own(device.delayInMs
                    .catchupAndSubscribe(owner => delayInMs.setValue(owner.getValue())))
            })
        }),
        delayInMs.catchupAndSubscribe(owner => adapter.midiDevice
            .ifSome(device => editing.modify(() => device.delayInMs.setValue(owner.getValue()))))
    )
    return (
        <div className={className}>
            <MenuButton root={MenuItem.root().setRuntimeChildrenProcedure(parent =>
                parent.addMenuItem(...MidiDevices.externalOutputDevices().match({
                    none: () => [MenuItem.default({label: "No MIDI requested.", selectable: false})],
                    some: outputs => outputs.length === 0
                        ? [MenuItem.default({label: "No device found.", selectable: false})]
                        : outputs.map(output => MenuItem.default({
                            label: output.name ?? "Unnamed device",
                            checked: output.id === adapter.box.device.targetVertex
                                .mapOr(({box}) => asInstanceOf(box, MIDIOutputBox).id.getValue(), "")
                        }).setTriggerProcedure(() => {
                            editing.modify(() => adapter.box.device.refer(getOrCreateMIDIOutput(rootBox, output).device))
                            deviceIdObserver(output.id) // TODO I think this is not needed anymore
                        }))
                })))} style={{width: "100%"}} appearance={{color: Colors.dark, activeColor: Colors.gray}}>
                <div className={deviceLabelClass}
                     onInit={element => {
                         const subscriber = lifecycle.own(new Terminator())
                         lifecycle.ownAll(
                             adapter.midiDevice.catchupAndSubscribe(opt => {
                                 subscriber.terminate()
                                 opt.match<unknown>({
                                     none: () => element.textContent = "No device selected",
                                     some: output => subscriber.ownAll(
                                         output.id.catchupAndSubscribe(owner => deviceIdObserver(owner.getValue())),
                                         output.label.catchupAndSubscribe(owner =>
                                             element.textContent = Strings.nonEmpty(
                                                 owner.getValue(), "No device selected"))
                                     )
                                 })
                             })
                         )
                     }}/>
            </MenuButton>
            <div className="delay">
                <span>Delay (ms):</span>
                <NumberInput lifecycle={lifecycle}
                             model={delayInMs}
                             guard={{
                                 guard: (value: int): int => clamp(value, 0, 500)
                             }}
                />
            </div>
        </div>
    )
}