import css from "./SoundfontDeviceEditor.sass?inline"
import {int, Lifecycle, UUID} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {DeviceEditor} from "@/ui/devices/DeviceEditor.tsx"
import {MenuItems} from "@/ui/devices/menu-items.ts"
import {DeviceHost, IconSymbol, Soundfont, SoundfontDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {DevicePeakMeter} from "@/ui/devices/panel/DevicePeakMeter.tsx"
import {Html} from "@opendaw/lib-dom"
import {StudioService} from "@/service/StudioService"
import {MenuItem} from "@/ui/model/menu-item"
import type {Preset} from "soundfont2"
import {MenuButton} from "@/ui/components/MenuButton"
import {Icon} from "@/ui/components/Icon"
import {InstrumentFactories, OpenSoundfontAPI} from "@opendaw/studio-core"
import {FlexSpacer} from "@/ui/components/FlexSpacer"
import {Promises} from "@opendaw/lib-runtime"
import {SoundfontFileBox} from "@opendaw/studio-boxes"

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
    const {boxGraph, editing, liveStreamReceiver} = project
    const labelSoundfontName: HTMLElement = <span/>
    const labelPresetName: HTMLElement = <span/>
    const soundFontMenu = MenuItem.root()

    ;(async () => {
        const {status, value: list, error} = await Promises.tryCatch(
            Promises.guardedRetry(() => OpenSoundfontAPI.get().all(), (_error, count) => count < 10))
        if (status === "rejected") {
            soundFontMenu.addMenuItem(MenuItem.default({label: String(error)}))
        } else {
            soundFontMenu.addMenuItem(...list.map((soundfont: Soundfont) => MenuItem.default({
                label: soundfont.name,
                checked: adapter.box.file.targetAddress.match({
                    none: () => false,
                    some: ({uuid}) => UUID.toString(uuid) === soundfont.uuid
                })
            }).setTriggerProcedure(() => {
                const uuid = UUID.parse(soundfont.uuid)
                editing.modify(() => {
                    const targetVertex = adapter.box.file.targetVertex.unwrapOrNull()
                    const fileBox = boxGraph.findBox<SoundfontFileBox>(uuid)
                        .unwrapOrElse(() => SoundfontFileBox.create(boxGraph, uuid, box =>
                            box.fileName.setValue(soundfont.name)))
                    adapter.box.file.refer(fileBox)
                    if (targetVertex?.box.isValid() === false) {
                        targetVertex.box.delete()
                    }
                })
            })))
        }
    })()
    lifecycle.ownAll(
        adapter.loader.catchupAndSubscribe(optLoader => {
            console.debug("optLoader", optLoader)
            labelSoundfontName.textContent = "Loading..."
            optLoader.ifSome(loader => {
                // TODO How to terminate
                loader.subscribe(state => {
                    console.debug("state", state)
                    if (state.type === "progress") {
                        labelSoundfontName.textContent = `Loading... ${Math.round(state.progress * 100)}%`
                    }
                })
            })
        }),
        adapter.soundfont.catchupAndSubscribe(optSoundfont =>
            labelSoundfontName.textContent = optSoundfont
                .mapOr(soundfont => soundfont.metaData.name, "No Soundfont")),
        adapter.preset.catchupAndSubscribe(optPreset =>
            labelPresetName.textContent = optPreset
                .mapOr(preset => preset.header.name, "No Preset"))
    )
    return (
        <DeviceEditor lifecycle={lifecycle}
                      project={project}
                      adapter={adapter}
                      populateMenu={parent => MenuItems.forAudioUnitInput(parent, service, deviceHost)}
                      populateControls={() => (
                          <div className={className}>
                              <FlexSpacer pixels={4}/>
                              <header>
                                  <Icon symbol={IconSymbol.Book}/>
                                  <h1>Soundfont</h1>
                              </header>
                              <div className="label">
                                  <MenuButton root={soundFontMenu}>
                                      {labelSoundfontName}
                                  </MenuButton>
                              </div>
                              <FlexSpacer pixels={4}/>
                              <header>
                                  <Icon symbol={IconSymbol.Piano}/>
                                  <h1>Preset</h1>
                              </header>
                              <div className="label">
                                  <MenuButton
                                      root={MenuItem.root().setRuntimeChildrenProcedure(parent => parent.addMenuItem(
                                          ...adapter.soundfont.mapOr(sf => sf.presets
                                                  .map((preset: Preset, index: int) => MenuItem.default({
                                                      label: `#${index + 1} ${preset.header.name}`
                                                  }).setTriggerProcedure(() =>
                                                      editing.modify(() => adapter.box.presetIndex.setValue(index)))),
                                              [MenuItem.default({label: "No soundfonts available"})])
                                      ))}>
                                      {labelPresetName}
                                  </MenuButton>
                              </div>
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