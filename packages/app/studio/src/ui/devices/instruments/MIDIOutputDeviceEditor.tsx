import css from "./MIDIOutputDeviceEditor.sass?inline"
import {Lifecycle} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {DeviceEditor} from "@/ui/devices/DeviceEditor.tsx"
import {MenuItems} from "@/ui/devices/menu-items.ts"
import {DeviceHost, MIDIOutputDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {Html} from "@opendaw/lib-dom"
import {StudioService} from "@/service/StudioService"
import {InstrumentFactories, MidiDevices} from "@opendaw/studio-core"
import {MenuButton} from "@/ui/components/MenuButton"
import {MenuItem} from "@/ui/model/menu-item"

const className = Html.adoptStyleSheet(css, "editor")

type Construct = {
    lifecycle: Lifecycle
    service: StudioService
    adapter: MIDIOutputDeviceBoxAdapter
    deviceHost: DeviceHost
}

export const MIDIOutputDeviceEditor = ({lifecycle, service, adapter, deviceHost}: Construct) => {
    const {project} = service
    return (
        <DeviceEditor lifecycle={lifecycle}
                      project={project}
                      adapter={adapter}
                      populateMenu={parent => MenuItems.forAudioUnitInput(parent, service, deviceHost)}
                      populateControls={() => (
                          <div className={className}>
                              <MenuButton root={MenuItem.root().setRuntimeChildrenProcedure(parent => {
                                  parent.addMenuItem(...MidiDevices.externalOutputDevices().match({
                                      none: () => [MenuItem.default({label: "No device found."})],
                                      some: outputs => outputs.map(output => MenuItem.default({
                                          label: output.name ?? "Unknown device"
                                      }).setTriggerProcedure(() => {
                                          project.connectMIDIOutput(adapter.address.uuid, output)
                                      }))
                                  }))
                              })}><span className="label"
                                        onInit={element => {
                                            lifecycle.own(MidiDevices.get().catchupAndSubscribe(option => option.match({
                                                none: () => element.textContent = "Request MIDI access",
                                                some: () => element.textContent = "Has MIDI access"
                                            })))
                                        }}>Select MIDI device...</span></MenuButton>
                          </div>
                      )}
                      populateMeter={() => false}
                      icon={InstrumentFactories.MIDIOutput.defaultIcon}/>
    )
}