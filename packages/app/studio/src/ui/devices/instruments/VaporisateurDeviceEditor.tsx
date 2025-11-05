import css from "./VaporisateurDeviceEditor.sass?inline"
import {Lifecycle} from "@opendaw/lib-std"
import {createElement, Frag, Group} from "@opendaw/lib-jsx"
import {DeviceEditor} from "@/ui/devices/DeviceEditor.tsx"
import {MenuItems} from "@/ui/devices/menu-items.ts"
import {AutomatableParameterFieldAdapter, DeviceHost, VaporisateurDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {DevicePeakMeter} from "@/ui/devices/panel/DevicePeakMeter.tsx"
import {Html} from "@opendaw/lib-dom"
import {StudioService} from "@/service/StudioService"
import {InstrumentFactories} from "@opendaw/studio-core"
import {ParameterLabel} from "@/ui/components/ParameterLabel"
import {RelativeUnitValueDragging} from "@/ui/wrapper/RelativeUnitValueDragging"

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
        filterKeyboard,
        filterOrder,
        lfoWaveform,
        lfoRate,
        lfoTargetTune,
        lfoTargetCutoff,
        lfoTargetVolume,
        attack,
        decay,
        sustain,
        release,
        voicingMode
    } = adapter.namedParameter
    const createLabelControlFrag = (parameter: AutomatableParameterFieldAdapter<number>) => (
        <Frag>
            <h3>{parameter.name}</h3>
            <RelativeUnitValueDragging lifecycle={lifecycle}
                                       editing={editing}
                                       parameter={parameter}
                                       supressValueFlyout={true}>
                <ParameterLabel lifecycle={lifecycle}
                                editing={editing}
                                midiLearning={midiLearning}
                                adapter={adapter}
                                parameter={parameter}
                                framed={true} standalone/>
            </RelativeUnitValueDragging>
        </Frag>
    )
    return (
        <DeviceEditor lifecycle={lifecycle}
                      project={project}
                      adapter={adapter}
                      populateMenu={parent => MenuItems.forAudioUnitInput(parent, service, deviceHost)}
                      populateControls={() => (
                          <div className={className}>
                              <Group>
                                  <header/>
                                  <div>{createLabelControlFrag(waveform)}</div>
                                  <div>{createLabelControlFrag(octave)}</div>
                                  <div>{createLabelControlFrag(tune)}</div>
                                  <div>{createLabelControlFrag(volume)}</div>
                              </Group>
                              <Group>
                                  <header/>
                                  <div>{createLabelControlFrag(voicingMode)}</div>
                                  <div>{createLabelControlFrag(glideTime)}</div>
                                  <div>{createLabelControlFrag(unisonCount)}</div>
                                  <div>{createLabelControlFrag(unisonDetune)}</div>
                              </Group>
                              <Group>
                                  <header/>
                                  <div>{createLabelControlFrag(cutoff)}</div>
                                  <div>{createLabelControlFrag(resonance)}</div>
                                  <div>{createLabelControlFrag(filterEnvelope)}</div>
                                  <div>{createLabelControlFrag(filterKeyboard)}</div>
                                  <div>{createLabelControlFrag(filterOrder)}</div>
                              </Group>
                              <Group>
                                  <header/>
                                  <div>{createLabelControlFrag(lfoWaveform)}</div>
                                  <div>{createLabelControlFrag(lfoRate)}</div>
                                  <div>{createLabelControlFrag(lfoTargetTune)}</div>
                                  <div>{createLabelControlFrag(lfoTargetCutoff)}</div>
                                  <div>{createLabelControlFrag(lfoTargetVolume)}</div>
                              </Group>
                              <Group>
                                  <header/>
                                  <div>{createLabelControlFrag(attack)}</div>
                                  <div>{createLabelControlFrag(decay)}</div>
                                  <div>{createLabelControlFrag(sustain)}</div>
                                  <div>{createLabelControlFrag(release)}</div>
                              </Group>
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