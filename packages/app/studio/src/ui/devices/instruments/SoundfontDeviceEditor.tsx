import css from "./SoundfontDeviceEditor.sass?inline"
import {int, Lifecycle} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {DeviceEditor} from "@/ui/devices/DeviceEditor.tsx"
import {MenuItems} from "@/ui/devices/menu-items.ts"
import {DeviceHost, SoundfontDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {DevicePeakMeter} from "@/ui/devices/panel/DevicePeakMeter.tsx"
import {Html} from "@opendaw/lib-dom"
import {StudioService} from "@/service/StudioService"
import {InstrumentFactories} from "@opendaw/studio-core"
import {MenuItem} from "@/ui/model/menu-item"
import type {Preset} from "soundfont2"
import {MenuButton} from "@/ui/components/MenuButton"

const className = Html.adoptStyleSheet(css, "editor")

type Construct = {
    lifecycle: Lifecycle
    service: StudioService
    adapter: SoundfontDeviceBoxAdapter
    deviceHost: DeviceHost
}

export const SoundfontDeviceEditor = ({lifecycle, service, adapter, deviceHost}: Construct) => {
    const {} = adapter.namedParameter
    const {project} = service
    const {editing, liveStreamReceiver} = project
    const labelPresetName: HTMLElement = <span/>
    lifecycle.ownAll(
        adapter.preset.catchupAndSubscribe(optPreset =>
            labelPresetName.textContent = optPreset.mapOr(preset => preset.header.name, "No Preset"))
    )
    return (
        <DeviceEditor lifecycle={lifecycle}
                      project={project}
                      adapter={adapter}
                      populateMenu={parent => {
                          parent.addMenuItem(MenuItem.default({
                              label: "Preset",
                              selectable: adapter.soundfont.nonEmpty()
                          }).setRuntimeChildrenProcedure(parent => parent.addMenuItem(
                              ...adapter.soundfont.unwrap().presets
                                  .map((preset: Preset, index: int) => MenuItem.default({label: preset.header.name})
                                      .setTriggerProcedure(() =>
                                          editing.modify(() => adapter.box.presetIndex.setValue(index))))
                          )))
                          MenuItems.forAudioUnitInput(parent, service, deviceHost)
                      }}
                      populateControls={() => (
                          <div className={className}>
                              <MenuButton
                                  root={MenuItem.root().setRuntimeChildrenProcedure(parent => parent.addMenuItem(
                                      ...adapter.soundfont.unwrap().presets
                                          .map((preset: Preset, index: int) => MenuItem.default({label: preset.header.name})
                                              .setTriggerProcedure(() =>
                                                  editing.modify(() => adapter.box.presetIndex.setValue(index))))
                                  ))}>
                                  {labelPresetName}
                              </MenuButton>
                          </div>
                      )}
                      populateMeter={() => (
                          <DevicePeakMeter lifecycle={lifecycle}
                                           receiver={liveStreamReceiver}
                                           address={adapter.address}/>
                      )}
                      icon={InstrumentFactories.Soundfont.defaultIcon}/>
    )
}