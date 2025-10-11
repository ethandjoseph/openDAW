import css from "./SoundfontView.sass?inline"
import {createElement} from "@opendaw/lib-jsx"
import {Exec, Lifecycle} from "@opendaw/lib-std"
import {Icon} from "../components/Icon"
import {IconSymbol, Soundfont} from "@opendaw/studio-adapters"
import {AssetLocation} from "@/ui/browse/AssetLocation"
import {Button} from "../components/Button"
import {ContextMenu} from "@/ui/ContextMenu"
import {MenuItem} from "@/ui/model/menu-item"
import {Html} from "@opendaw/lib-dom"
import {DragAndDrop} from "@/ui/DragAndDrop"
import {SoundfontSelection} from "@/ui/browse/SoundfontSelection"

const className = Html.adoptStyleSheet(css, "Soundfont")

type Construct = {
    lifecycle: Lifecycle
    soundfontSelection: SoundfontSelection
    soundfont: Soundfont
    location: AssetLocation
    refresh: Exec
}

export const SoundfontView = ({
                                  lifecycle, soundfontSelection, soundfont, location, refresh
                              }: Construct) => {
    const {name} = soundfont
    const deleteButton: Element = (
        <Button lifecycle={lifecycle} appearance={{activeColor: "white"}}
                onClick={async (event) => {
                    event.stopPropagation()
                    await soundfontSelection.deleteSoundfonts(soundfont)
                    refresh()
                }}>
            <Icon symbol={IconSymbol.Close}/>
        </Button>
    )
    const element: HTMLElement = (
        <div className={className}
             data-selection={JSON.stringify(soundfont)}
             draggable>
            <div className="meta">
                <span>{name}</span>
            </div>
            {location === AssetLocation.Local && (
                <div className="edit">
                    {deleteButton}
                </div>
            )}
        </div>
    )
    lifecycle.ownAll(
        DragAndDrop.installSource(element, () => ({type: "soundfont", soundfont})),
        ContextMenu.subscribe(element, collector => collector.addItems(
            MenuItem.default({label: "Create Soundfont Device"})
                .setTriggerProcedure(() => soundfontSelection.requestDevice()),
            MenuItem.default({label: "Delete Soundfont(s)", selectable: location === AssetLocation.Local})
                .setTriggerProcedure(async () => {
                    await soundfontSelection.deleteSelected()
                    refresh()
                }))
        )
    )
    return element
}