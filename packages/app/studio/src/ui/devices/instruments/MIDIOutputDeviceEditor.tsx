import css from "./MIDIOutputDeviceEditor.sass?inline"
import {Lifecycle} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {DeviceEditor} from "@/ui/devices/DeviceEditor.tsx"
import {MenuItems} from "@/ui/devices/menu-items.ts"
import {DeviceHost, MIDIOutputDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {Html} from "@opendaw/lib-dom"
import {StudioService} from "@/service/StudioService"
import {InstrumentFactories} from "@opendaw/studio-core"
import {MidiData} from "@opendaw/lib-midi"

const className = Html.adoptStyleSheet(css, "editor")

type Construct = {
    lifecycle: Lifecycle
    service: StudioService
    adapter: MIDIOutputDeviceBoxAdapter
    deviceHost: DeviceHost
}

export const MIDIOutputDeviceEditor = ({lifecycle, service, adapter, deviceHost}: Construct) => {
    const {project} = service
    const {liveStreamReceiver} = project
    return (
        <DeviceEditor lifecycle={lifecycle}
                      project={project}
                      adapter={adapter}
                      populateMenu={parent => MenuItems.forAudioUnitInput(parent, service, deviceHost)}
                      populateControls={() => (
                          <div className={className}>
                              {(() => {
                                  lifecycle.own(liveStreamReceiver.subscribeIntegers(adapter.address, stream => {
                                      let index = 0
                                      while (true) {
                                          const header = stream[index++]
                                          if (header === -1) {return}
                                          if (header === MidiData.Command.NoteOn) {
                                              const pitch = stream[index++]
                                              const velocity = stream[index++]
                                              console.debug("start", pitch, velocity)
                                          } else if (header === MidiData.Command.NoteOff) {
                                              const pitch = stream[index++]
                                              console.debug("stop", pitch)
                                          }
                                      }
                                  }))
                                  return "MIDIOutput"
                              })()}
                          </div>
                      )}
                      populateMeter={() => false}
                      icon={InstrumentFactories.MIDIOutput.defaultIcon}/>
    )
}