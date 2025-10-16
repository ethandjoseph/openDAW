import css from "./CompressorDeviceEditor.sass?inline"
import {CompressorDeviceBoxAdapter, DeviceHost} from "@opendaw/studio-adapters"
import {Lifecycle} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {DeviceEditor} from "@/ui/devices/DeviceEditor.tsx"
import {MenuItems} from "@/ui/devices/menu-items.ts"
import {ControlBuilder} from "@/ui/devices/ControlBuilder.tsx"
import {DevicePeakMeter} from "@/ui/devices/panel/DevicePeakMeter.tsx"
import {Html} from "@opendaw/lib-dom"
import {StudioService} from "@/service/StudioService"
import {EffectFactories} from "@opendaw/studio-core"
import {PrimitiveValues} from "@opendaw/lib-box"

const className = Html.adoptStyleSheet(css, "CompressorDeviceEditor")

type Construct = {
    lifecycle: Lifecycle
    service: StudioService
    adapter: CompressorDeviceBoxAdapter
    deviceHost: DeviceHost
}

export const CompressorDeviceEditor = ({lifecycle, service, adapter, deviceHost}: Construct) => {
    const {project} = service
    const {editing, midiLearning} = project
    lifecycle.own(project.liveStreamReceiver.subscribeFloat(adapter.address.append(0), _value => {
        // console.debug(value)
    }))
    return (
        <DeviceEditor lifecycle={lifecycle}
                      project={project}
                      adapter={adapter}
                      populateMenu={parent => MenuItems.forEffectDevice(parent, service, deviceHost, adapter)}
                      populateControls={() => (
                          <div className={className}>
                              {Object.values(adapter.namedParameter).map(parameter =>
                                  ControlBuilder.createKnob<PrimitiveValues>({
                                      lifecycle,
                                      editing,
                                      midiLearning,
                                      adapter,
                                      parameter
                                  })
                              )}
                          </div>)}
                      populateMeter={() => (
                          <DevicePeakMeter lifecycle={lifecycle}
                                           receiver={project.liveStreamReceiver}
                                           address={adapter.address}/>
                      )}
                      icon={EffectFactories.AudioNamed.Compressor.defaultIcon}/>
    )
}