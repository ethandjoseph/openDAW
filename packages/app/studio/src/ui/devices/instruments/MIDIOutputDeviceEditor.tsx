import css from "./MIDIOutputDeviceEditor.sass?inline"
import {clamp, int, Lifecycle, ObservableValue, ParseResult, StringResult, Strings, UUID} from "@opendaw/lib-std"
import {createElement, Inject, replaceChildren} from "@opendaw/lib-jsx"
import {DeviceEditor} from "@/ui/devices/DeviceEditor.tsx"
import {MenuItems} from "@/ui/devices/menu-items.ts"
import {DeviceHost, IconSymbol, MIDIOutputDeviceBoxAdapter, TrackType} from "@opendaw/studio-adapters"
import {Html} from "@opendaw/lib-dom"
import {StudioService} from "@/service/StudioService"
import {Colors, InstrumentFactories, MidiDevices} from "@opendaw/studio-core"
import {MenuButton} from "@/ui/components/MenuButton"
import {MenuItem} from "@/ui/model/menu-item"
import {Icon} from "@/ui/components/Icon"
import {NumberInput} from "@/ui/components/NumberInput"
import {EditWrapper} from "@/ui/wrapper/EditWrapper"
import {TrackBox, UnitParameterBox} from "@opendaw/studio-boxes"

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
    const deviceLabelClass = Inject.classList("device-label")
    const deviceIdObserver = (owner: ObservableValue<string>) => {
        const requestedId = owner.getValue()
        const optDevice = MidiDevices.externalOutputDevices()
            .map(devices => devices.find(device => device.id === requestedId))
        deviceLabelClass.toggle("not-available", optDevice.isEmpty() && requestedId !== "")
        optDevice.ifSome(device => project.connectMIDIOutput(adapter.box, device))
    }
    return (
        <DeviceEditor lifecycle={lifecycle}
                      project={project}
                      adapter={adapter}
                      populateMenu={parent => MenuItems.forAudioUnitInput(parent, service, deviceHost)}
                      populateControls={() => (
                          <div className={className} onInit={element => {
                              MidiDevices.get().catchupAndSubscribe(option => option.match({
                                  none: () => replaceChildren(element,
                                      MidiDevices.canRequestMidiAccess() ? (
                                          <div className="request-midi" onclick={() => MidiDevices.requestPermission()}>
                                              <span>Request </span>
                                              <Icon symbol={IconSymbol.Midi}/>
                                          </div>
                                      ) : (
                                          <div className="no-midi-support">
                                              <div>You browser does not support MIDI</div>
                                              <div>Tip: Chrome and Firefox do</div>
                                          </div>
                                      )),
                                  some: () => replaceChildren(element, (
                                      <div className="selector">
                                          <MenuButton root={MenuItem.root().setRuntimeChildrenProcedure(parent =>
                                              parent.addMenuItem(...MidiDevices.externalOutputDevices().match({
                                                  none: () => [MenuItem.default({
                                                      label: "No MIDI requested.",
                                                      selectable: false
                                                  })],
                                                  some: outputs => outputs.length === 0
                                                      ? [MenuItem.default({
                                                          label: "No device found.",
                                                          selectable: false
                                                      })]
                                                      : outputs.map(output => MenuItem.default({
                                                          label: output.name ?? "Unnamed device"
                                                      }).setTriggerProcedure(() => {
                                                          editing.modify(() => {
                                                              adapter.box.device.id.setValue(output.id)
                                                              adapter.box.device.label.setValue(output.name ?? "Unnamed device")
                                                          })
                                                          // updating UI if id was the same
                                                          deviceIdObserver(adapter.box.device.id)
                                                      }))
                                              })))}
                                                      style={{width: "100%"}}
                                                      appearance={{
                                                          color: Colors.dark,
                                                          activeColor: Colors.gray
                                                      }}>
                                              <div className={deviceLabelClass}
                                                   onInit={element => {
                                                       lifecycle.ownAll(
                                                           adapter.box.device.id.catchupAndSubscribe(deviceIdObserver),
                                                           adapter.box.device.label.catchupAndSubscribe(owner =>
                                                               element.textContent = Strings.nonEmpty(
                                                                   owner.getValue(), "No device selected"))
                                                       )
                                                   }}/>
                                          </MenuButton>
                                          <div className="number-inputs">
                                              <span>Channel:</span>
                                              <NumberInput lifecycle={lifecycle}
                                                           model={EditWrapper.forValue(editing, adapter.box.channel)}
                                                           mapper={{
                                                               y: (x: string): ParseResult<number> => {
                                                                   const int = parseInt(x)
                                                                   return Number.isFinite(int)
                                                                       ? {type: "explicit", value: int - 1}
                                                                       : {type: "unknown", value: x}
                                                               },
                                                               x: (y: number): StringResult => ({
                                                                   unit: "#",
                                                                   value: String(y + 1)
                                                               })
                                                           }}
                                                           guard={{
                                                               guard: (value: int): int => clamp(value, 0, 15)
                                                           }}
                                              />
                                          </div>
                                          <div className="number-inputs">
                                              <span>Delay (ms):</span>
                                              <NumberInput lifecycle={lifecycle}
                                                           model={EditWrapper.forValue(editing, adapter.box.delay)}
                                                           guard={{
                                                               guard: (value: int): int => clamp(value, 0, 500)
                                                           }}
                                              />
                                          </div>
                                          <button onclick={() => {
                                              editing.modify(() => {
                                                  const tracks = adapter.audioUnitBoxAdapter().box.tracks
                                                  const parameter = UnitParameterBox.create(
                                                      project.boxGraph, UUID.generate(),
                                                      box => box.owner.refer(adapter.box.parameters)) // TODO add label
                                                  TrackBox.create(project.boxGraph, UUID.generate(), box => {
                                                      box.target.refer(parameter.value)
                                                      box.tracks.refer(tracks)
                                                      box.type.setValue(TrackType.Value)
                                                      box.index.setValue(tracks.pointerHub.incoming().length)
                                                  })
                                              })
                                          }}></button>
                                      </div>
                                  ))
                              }))
                          }}>
                          </div>
                      )}
                      populateMeter={() => false}
                      icon={InstrumentFactories.MIDIOutput.defaultIcon}/>
    )
}