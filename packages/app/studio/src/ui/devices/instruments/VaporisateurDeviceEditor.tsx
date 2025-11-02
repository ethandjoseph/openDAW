import css from "./VaporisateurDeviceEditor.sass?inline"
import {Lifecycle} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {DeviceEditor} from "@/ui/devices/DeviceEditor.tsx"
import {MenuItems} from "@/ui/devices/menu-items.ts"
import {DeviceHost, VaporisateurDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {ControlBuilder} from "@/ui/devices/ControlBuilder.tsx"
import {DevicePeakMeter} from "@/ui/devices/panel/DevicePeakMeter.tsx"
import {Html} from "@opendaw/lib-dom"
import {StudioService} from "@/service/StudioService"
import {InstrumentFactories} from "@opendaw/studio-core"

const className = Html.adoptStyleSheet(css, "editor")

type Construct = {
    lifecycle: Lifecycle
    service: StudioService
    adapter: VaporisateurDeviceBoxAdapter
    deviceHost: DeviceHost
}

export const VaporisateurDeviceEditor = ({lifecycle, service, adapter, deviceHost}: Construct) => {
    const {project} = service
    const {editing, midiLearning, liveStreamReceiver} = project
    const {
        volume,
        octave,
        tune,
        unisonCount,
        unisonDetune,
        glideTime,
        waveform,
        cutoff,
        resonance,
        filterEnvelope,
        attack,
        decay,
        sustain,
        release,
        voicingMode
    } = adapter.namedParameter
    const order = [
        voicingMode,
        glideTime,
        octave,
        tune,
        unisonCount,

        volume,
        waveform,
        cutoff,
        resonance,
        unisonDetune,

        attack,
        decay,
        sustain,
        release,
        filterEnvelope
    ]
    return (
        <DeviceEditor lifecycle={lifecycle}
                      project={project}
                      adapter={adapter}
                      populateMenu={parent => MenuItems.forAudioUnitInput(parent, service, deviceHost)}
                      populateControls={() => (
                          <div className={className}>
                              {order.map(parameter => {
                                  if (parameter === null) {return <div/>}
                                  return ControlBuilder.createKnob({
                                      lifecycle,
                                      editing,
                                      midiLearning,
                                      adapter,
                                      parameter,
                                      anchor: parameter === filterEnvelope
                                      || parameter === octave || parameter === tune ? 0.5 : 0.0
                                  })
                              })}
                          </div>
                      )}
                      populateMeter={() => (
                          <DevicePeakMeter lifecycle={lifecycle}
                                           receiver={liveStreamReceiver}
                                           address={adapter.address}/>
                      )}
                      icon={InstrumentFactories.Vaporisateur.defaultIcon}/>
    )
}