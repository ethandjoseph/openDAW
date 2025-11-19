import css from "./DattorroReverbDeviceEditor.sass?inline"
import {
    AutomatableParameterFieldAdapter,
    Colors,
    DattorroReverbDeviceBoxAdapter,
    DeviceHost
} from "@opendaw/studio-adapters"
import {int, Lifecycle} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {DeviceEditor} from "@/ui/devices/DeviceEditor.tsx"
import {MenuItems} from "@/ui/devices/menu-items.ts"
import {ControlBuilder} from "@/ui/devices/ControlBuilder.tsx"
import {DevicePeakMeter} from "@/ui/devices/panel/DevicePeakMeter.tsx"
import {Html} from "@opendaw/lib-dom"
import {StudioService} from "@/service/StudioService"
import {EffectFactories} from "@opendaw/studio-core"
import {ControlGroup} from "@/ui/devices/ControlGroup"
import {Display} from "@/ui/devices/audio-effects/DattorroReverb/Display"

const className = Html.adoptStyleSheet(css, "DattorroReverbDeviceEditor")

type Construct = {
    lifecycle: Lifecycle
    service: StudioService
    adapter: DattorroReverbDeviceBoxAdapter
    deviceHost: DeviceHost
}

export const DattorroReverbDeviceEditor = ({lifecycle, service, adapter, deviceHost}: Construct) => {
    const {project} = service
    const {editing, midiLearning, liveStreamReceiver} = project
    const createKnob = (parameter: AutomatableParameterFieldAdapter<number>, u: int, v: int, color?: string) =>
        ControlBuilder.createKnob({
            lifecycle, editing, midiLearning, adapter, parameter, style: {gridArea: `${v + 1}/${u + 1}`}, color
        })
    const {
        decay, preDelay, bandwidth, damping,
        inputDiffusion1, inputDiffusion2, decayDiffusion1, decayDiffusion2, excursionRate, excursionDepth,
        dry, wet
    } = adapter.namedParameter
    return (
        <DeviceEditor lifecycle={lifecycle}
                      project={project}
                      adapter={adapter}
                      populateMenu={parent => MenuItems.forEffectDevice(parent, service, deviceHost, adapter)}
                      populateControls={() => (
                          <div className={className}>
                              {createKnob(preDelay, 0, 0)}
                              {createKnob(bandwidth, 0, 1)}
                              {createKnob(damping, 0, 2)}
                              {createKnob(dry, 3, 2)}
                              {createKnob(wet, 4, 2)}
                              {createKnob(decay, 1, 0, Colors.green)}
                              <Display lifecycle={lifecycle}
                                       liveStreamReceiver={liveStreamReceiver}
                                       adapter={adapter}
                                       gridUV={{u: 2, v: 0}}/>
                              <ControlGroup lifecycle={lifecycle}
                                            gridUV={{u: 1, v: 1}}
                                            color={Colors.green}
                                            name="Decay Diffusion"
                                            editing={editing}
                                            midiLearning={midiLearning}
                                            parameters={[decayDiffusion1, decayDiffusion2]}
                                            deviceAdapter={adapter}/>
                              <ControlGroup lifecycle={lifecycle}
                                            gridUV={{u: 1, v: 2}}
                                            color={Colors.blue}
                                            name="Input Diffusion"
                                            editing={editing}
                                            midiLearning={midiLearning}
                                            parameters={[inputDiffusion1, inputDiffusion2]}
                                            deviceAdapter={adapter}/>
                              <ControlGroup lifecycle={lifecycle}
                                            gridUV={{u: 3, v: 1}}
                                            color={Colors.purple}
                                            name="Excursion"
                                            editing={editing}
                                            midiLearning={midiLearning}
                                            parameters={[excursionRate, excursionDepth]}
                                            deviceAdapter={adapter}/>

                              {{/*Object.values(adapter.namedParameter).map(parameter => ControlBuilder.createKnob({
                                  lifecycle,
                                  editing,
                                  midiLearning,
                                  adapter,
                                  parameter
                              }))*/
                              }}
                          </div>)}
                      populateMeter={() => (
                          <DevicePeakMeter lifecycle={lifecycle}
                                           receiver={project.liveStreamReceiver}
                                           address={adapter.address}/>
                      )}
                      icon={EffectFactories.AudioNamed.DattorroReverb.defaultIcon}/>
    )
}