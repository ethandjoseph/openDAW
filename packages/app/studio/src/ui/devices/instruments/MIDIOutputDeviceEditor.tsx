import css from "./MIDIOutputDeviceEditor.sass?inline"
import {Lifecycle} from "@opendaw/lib-std"
import {createElement, Frag, replaceChildren} from "@opendaw/lib-jsx"
import {DeviceEditor} from "@/ui/devices/DeviceEditor.tsx"
import {MenuItems} from "@/ui/devices/menu-items.ts"
import {DeviceHost, MIDIOutputDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {Html} from "@opendaw/lib-dom"
import {StudioService} from "@/service/StudioService"
import {InstrumentFactories, MidiDevices} from "@opendaw/studio-core"
import {RequestMidiButton} from "@/ui/devices/instruments/MIDIOutputEditor/RequestMidiButton"
import {NoMidiSupport} from "@/ui/devices/instruments/MIDIOutputEditor/NoMidiSupport"
import {DeviceSelector} from "@/ui/devices/instruments/MIDIOutputEditor/DeviceSelector"
import {ControlValues} from "@/ui/devices/instruments/MIDIOutputEditor/ControlValues"
import {DeviceParameters} from "@/ui/devices/instruments/MIDIOutputEditor/DeviceParameters"
import {AddParameterButton} from "@/ui/devices/instruments/MIDIOutputEditor/AddParameterButton"

const className = Html.adoptStyleSheet(css, "editor")

type Construct = {
    lifecycle: Lifecycle
    service: StudioService
    adapter: MIDIOutputDeviceBoxAdapter
    deviceHost: DeviceHost
}

export const MIDIOutputDeviceEditor = ({lifecycle, service, adapter, deviceHost}: Construct) => {
    const {project} = service
    const {editing} = project
    return (
        <DeviceEditor lifecycle={lifecycle}
                      project={project}
                      adapter={adapter}
                      populateMenu={parent => MenuItems.forAudioUnitInput(parent, service, deviceHost)}
                      populateControls={() => (
                          <div className={className}
                               onInit={element => MidiDevices.get()
                                   .catchupAndSubscribe(option => option.match({
                                       none: () => replaceChildren(element,
                                           MidiDevices.canRequestMidiAccess()
                                               ? <RequestMidiButton/>
                                               : <NoMidiSupport/>),
                                       some: () => replaceChildren(element, (
                                           <Frag>
                                               <DeviceSelector lifecycle={lifecycle}
                                                               project={project}
                                                               adapter={adapter}/>
                                               <DeviceParameters lifecycle={lifecycle}
                                                                 editing={editing}
                                                                 box={adapter.box}/>
                                               <ControlValues lifecycle={lifecycle}
                                                              project={project}
                                                              adapter={adapter}/>
                                               <AddParameterButton project={project} adapter={adapter}/>
                                           </Frag>
                                       ))
                                   }))}>
                          </div>
                      )}
                      populateMeter={() => false}
                      icon={InstrumentFactories.MIDIOutput.defaultIcon}/>
    )
}