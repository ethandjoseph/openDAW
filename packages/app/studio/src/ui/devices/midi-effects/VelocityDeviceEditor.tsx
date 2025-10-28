import css from "./VelocityDeviceEditor.sass?inline"
import {DeviceHost, IconSymbol, VelocityDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {Lifecycle} from "@opendaw/lib-std"
import {DeviceEditor} from "@/ui/devices/DeviceEditor.tsx"
import {MenuItems} from "@/ui/devices/menu-items.ts"
import {createElement} from "@opendaw/lib-jsx"
import {ControlBuilder} from "@/ui/devices/ControlBuilder.tsx"
import {DeviceMidiMeter} from "@/ui/devices/panel/DeviceMidiMeter.tsx"
import {Html} from "@opendaw/lib-dom"
import {StudioService} from "@/service/StudioService"
import {EffectFactories} from "@opendaw/studio-core"
import {Icon} from "@/ui/components/Icon"

const className = Html.adoptStyleSheet(css, "VelocityDeviceEditor")

type Construct = {
    lifecycle: Lifecycle
    service: StudioService
    adapter: VelocityDeviceBoxAdapter
    deviceHost: DeviceHost
}

export const VelocityDeviceEditor = ({lifecycle, service, adapter, deviceHost}: Construct) => {
    const {project} = service
    const {editing, liveStreamReceiver, midiLearning} = project
    return (
        <DeviceEditor lifecycle={lifecycle}
                      project={project}
                      adapter={adapter}
                      populateMenu={parent => MenuItems.forEffectDevice(parent, service, deviceHost, adapter)}
                      populateControls={() => (
                          <div className={className}>
                              <div className="header">
                                  <div className="canvas"/>
                                  <Icon symbol={IconSymbol.Magnet}/>
                                  <Icon symbol={IconSymbol.Random}/>
                                  <Icon symbol={IconSymbol.Add}/>
                              </div>
                              {Object.values(adapter.namedParameter).map(parameter => ControlBuilder.createKnob({
                                  lifecycle,
                                  editing,
                                  midiLearning,
                                  adapter,
                                  parameter
                              }))
                              }
                          </div>
                      )}
                      populateMeter={() => (
                          <DeviceMidiMeter lifecycle={lifecycle}
                                           receiver={liveStreamReceiver}
                                           address={adapter.address}/>
                      )}
                      icon={EffectFactories.MidiNamed.Velocity.defaultIcon}/>
    )
}