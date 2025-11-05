import css from "./VaporisateurDeviceEditor.sass?inline"
import {isDefined, Lifecycle} from "@opendaw/lib-std"
import {createElement, Frag} from "@opendaw/lib-jsx"
import {DeviceEditor} from "@/ui/devices/DeviceEditor.tsx"
import {MenuItems} from "@/ui/devices/menu-items.ts"
import {AutomatableParameterFieldAdapter, DeviceHost, VaporisateurDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {DevicePeakMeter} from "@/ui/devices/panel/DevicePeakMeter.tsx"
import {Html} from "@opendaw/lib-dom"
import {StudioService} from "@/service/StudioService"
import {InstrumentFactories} from "@opendaw/studio-core"
import {ParameterLabel} from "@/ui/components/ParameterLabel"
import {RelativeUnitValueDragging} from "@/ui/wrapper/RelativeUnitValueDragging"
import {RadioGroup} from "@/ui/components/RadioGroup"
import {Icon} from "@/ui/components/Icon"
import {IconSymbol} from "@opendaw/studio-enums"
import {ClassicWaveform} from "@opendaw/lib-dsp"
import {EditWrapper} from "@/ui/wrapper/EditWrapper"
import {WaveformDisplay} from "@/ui/devices/instruments/VaporisateurDeviceEditor/WaveformDisplay"
import {EnvelopeDisplay} from "@/ui/devices/instruments/VaporisateurDeviceEditor/EnvelopeDisplay"
import {FilterDisplay} from "@/ui/devices/instruments/VaporisateurDeviceEditor/FilterDisplay"
import {Logo} from "@/ui/devices/instruments/VaporisateurDeviceEditor/Logo"

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
        unisonStereo,
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
    const createLabelControlFrag = (parameter: AutomatableParameterFieldAdapter<number>,
                                    threshold?: number | ReadonlyArray<number>) => (
        <Frag>
            <h3>{parameter.name}</h3>
            <RelativeUnitValueDragging lifecycle={lifecycle}
                                       editing={editing}
                                       parameter={parameter}
                                       options={isDefined(threshold) ? {snap: {threshold}} : undefined}
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
    const createWaveformSelector = (parameter: AutomatableParameterFieldAdapter<ClassicWaveform>) => (
        <Frag>
            <h3>{parameter.name}</h3>
            <RadioGroup lifecycle={lifecycle}
                        model={EditWrapper.forAutomatableParameter(editing, parameter)}
                        style={{fontSize: "9px"}}
                        elements={[
                            {
                                value: ClassicWaveform.sine,
                                element: <Icon symbol={IconSymbol.Sine}/>
                            },
                            {
                                value: ClassicWaveform.triangle,
                                element: <Icon symbol={IconSymbol.Triangle}/>
                            },
                            {
                                value: ClassicWaveform.saw,
                                element: <Icon symbol={IconSymbol.Sawtooth}/>
                            },
                            {
                                value: ClassicWaveform.square,
                                element: <Icon symbol={IconSymbol.Square
                                }/>
                            }
                        ]}/>
        </Frag>
    )
    return (
        <DeviceEditor lifecycle={lifecycle}
                      project={project}
                      adapter={adapter}
                      populateMenu={parent => MenuItems.forAudioUnitInput(parent, service, deviceHost)}
                      populateControls={() => (
                          <div className={className}>
                              <div style={{display: "contents"}}>
                                  <Logo/>
                                  <div>
                                      <h3>Play-Mode</h3>
                                      <RadioGroup lifecycle={lifecycle}
                                                  model={EditWrapper.forAutomatableParameter(editing, voicingMode)}
                                                  style={{fontSize: "9px"}}
                                                  elements={[
                                                      {
                                                          value: 0,
                                                          element: <span>MONO</span>
                                                      },
                                                      {
                                                          value: 1,
                                                          element: <span>POLY</span>
                                                      }
                                                  ]}/>
                                  </div>
                                  <div>{createLabelControlFrag(glideTime)}</div>
                                  <div>{createLabelControlFrag(unisonCount)}</div>
                                  <div>{createLabelControlFrag(unisonDetune, 0.5)}</div>
                                  <div>{createLabelControlFrag(unisonStereo)}</div>
                              </div>
                              <div style={{display: "contents"}}>
                                  <header>
                                      <WaveformDisplay lifecycle={lifecycle} adapter={waveform}/>
                                  </header>
                                  <div>{createWaveformSelector(waveform)}</div>
                                  <div>{createLabelControlFrag(octave)}</div>
                                  <div>{createLabelControlFrag(tune, 0.5)}</div>
                                  <div>{createLabelControlFrag(volume)}</div>
                              </div>
                              <div style={{display: "contents"}}>
                                  <header>
                                      <FilterDisplay lifecycle={lifecycle}
                                                     cutoff={cutoff}
                                                     resonance={resonance}
                                                     order={filterOrder}/>
                                  </header>
                                  <div>{createLabelControlFrag(cutoff)}</div>
                                  <div>{createLabelControlFrag(resonance)}</div>
                                  <div>{createLabelControlFrag(filterEnvelope, 0.5)}</div>
                                  <div>{createLabelControlFrag(filterKeyboard, 0.5)}</div>
                                  <div>{createLabelControlFrag(filterOrder, 0.5)}</div>
                              </div>
                              <div style={{display: "contents"}}>
                                  <header>
                                      <WaveformDisplay lifecycle={lifecycle} adapter={lfoWaveform}/>
                                  </header>
                                  <div>{createWaveformSelector(lfoWaveform)}</div>
                                  <div>{createLabelControlFrag(lfoRate)}</div>
                                  <div>{createLabelControlFrag(lfoTargetTune, 0.5)}</div>
                                  <div>{createLabelControlFrag(lfoTargetCutoff, 0.5)}</div>
                                  <div>{createLabelControlFrag(lfoTargetVolume, 0.5)}</div>
                              </div>
                              <div style={{display: "contents"}}>
                                  <header>
                                      <EnvelopeDisplay lifecycle={lifecycle}
                                                       sustain={sustain}
                                                       receiver={liveStreamReceiver}
                                                       address={adapter.address.append(0)}/>
                                  </header>
                                  <div>{createLabelControlFrag(attack)}</div>
                                  <div>{createLabelControlFrag(decay)}</div>
                                  <div>{createLabelControlFrag(sustain)}</div>
                                  <div>{createLabelControlFrag(release)}</div>
                              </div>
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