import css from "./SampleView.sass?inline"
import {createElement} from "@opendaw/lib-jsx"
import {Exec, Lifecycle, Objects, UUID} from "@opendaw/lib-std"
import {SamplePlayback} from "@/service/SamplePlayback"
import {Icon} from "../components/Icon"
import {IconSymbol, Sample} from "@opendaw/studio-adapters"
import {AssetLocation} from "@/ui/browse/AssetLocation"
import {Button} from "../components/Button"
import {SampleDialogs} from "@/ui/browse/SampleDialogs"
import {ContextMenu} from "@/ui/ContextMenu"
import {MenuItem} from "@/ui/model/menu-item"
import {SampleSelection} from "@/ui/browse/SampleSelection"
import {Html} from "@opendaw/lib-dom"
import {Promises} from "@opendaw/lib-runtime"
import {DragAndDrop} from "@/ui/DragAndDrop"
import {SampleStorage} from "@opendaw/studio-core"

const className = Html.adoptStyleSheet(css, "Sample")

type Construct = {
    lifecycle: Lifecycle
    sampleSelection: SampleSelection
    sample: Sample
    playback: SamplePlayback
    location: AssetLocation
    refresh: Exec
}

export const SampleView = ({lifecycle, sampleSelection, sample, playback, location, refresh}: Construct) => {
    const {name, duration, bpm} = sample
    const labelName: HTMLElement = <span>{name}</span>
    const labelBpm: HTMLElement = <span className="right">{bpm.toFixed(1)}</span>
    const editButton: Element = (
        <Button lifecycle={lifecycle} appearance={{activeColor: "white"}}
                onClick={async (event) => {
                    event.stopPropagation()
                    const {status, value: meta} = await Promises.tryCatch(SampleDialogs.showEditSampleDialog(sample))
                    if (status === "resolved") {
                        await SampleStorage.get()
                            .updateSampleMeta(UUID.parse(meta.uuid), Objects.exclude(meta, "uuid"))
                        refresh()
                    }
                }}>
            <Icon symbol={IconSymbol.Pencil}/>
        </Button>
    )
    const deleteButton: Element = (
        <Button lifecycle={lifecycle} appearance={{activeColor: "white"}}
                onClick={async (event) => {
                    event.stopPropagation()
                    await sampleSelection.deleteSamples(sample)
                    refresh()
                }}>
            <Icon symbol={IconSymbol.Close}/>
        </Button>
    )
    const metaElement: HTMLElement = (
        <div className="meta" ondblclick={() => playback.toggle(sample.uuid)}>
            {labelName}
            {labelBpm}
            <span className="right">{duration.toFixed(1)}</span>
        </div>
    )
    const element: HTMLElement = (
        <div className={className}
             data-selection={JSON.stringify(sample)}
             ondragstart={() => playback.eject()}
             draggable>
            {metaElement}
            {location === AssetLocation.Local && (
                <div className="edit">
                    {editButton}
                    {deleteButton}
                </div>
            )}
        </div>
    )
    lifecycle.ownAll(
        DragAndDrop.installSource(element, () => ({type: "sample", sample})),
        ContextMenu.subscribe(element, collector => collector.addItems(
            MenuItem.default({label: "Create Audio Track(s)"})
                .setTriggerProcedure(() => sampleSelection.requestDevice()),
            MenuItem.default({label: "Delete Sample(s)", selectable: location === AssetLocation.Local})
                .setTriggerProcedure(async () => {
                    await sampleSelection.deleteSelected()
                    refresh()
                }))
        ),
        playback.subscribe(sample.uuid, event => {
            metaElement.classList.remove("buffering", "playing", "error")
            metaElement.classList.add(event.type)
            switch (event.type) {
                case "idle":
                    break
                case "buffering":
                    break
                case "playing":
                    break
                case "error":
                    break
            }
        })
    )
    return element
}