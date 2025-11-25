import {AudioWarpingBoxAdapter, FilteredSelection, WarpMarkerBoxAdapter} from "@opendaw/studio-adapters"
import {Project, TimelineRange} from "@opendaw/studio-core"
import {AudioEventOwnerReader} from "@/ui/timeline/editors/EventOwnerReader"
import {WarpMarkerBox} from "@opendaw/studio-boxes"
import {ContextMenu} from "@/ui/ContextMenu"
import {clamp, isNotNull, isNull, Option, Terminable, Terminator, UUID} from "@opendaw/lib-std"
import {MenuItem} from "@/ui/model/menu-item"
import {DebugMenus} from "@/ui/menu/debug"
import {WarpMarkerUtils} from "@/ui/timeline/editors/audio/WarpMarkerUtils"
import {Dragging, Events, Keyboard} from "@opendaw/lib-dom"
import {PPQN} from "@opendaw/lib-dsp"
import {Snapping} from "@/ui/timeline/Snapping"

export namespace WarpMarkerEditing {
    const MIN_DISTANCE = PPQN.SemiQuaver
    const MARKER_RADIUS = 7

    export const install = (warping: AudioWarpingBoxAdapter,
                            project: Project,
                            canvas: HTMLCanvasElement,
                            range: TimelineRange,
                            snapping: Snapping,
                            reader: AudioEventOwnerReader): Terminable => {
        const terminator = new Terminator()
        const {warpMarkers} = warping
        const capturing = WarpMarkerUtils.createCapturing(
            canvas, range, reader, warpMarkers, MARKER_RADIUS)
        const selection: FilteredSelection<WarpMarkerBoxAdapter> = terminator.own(
            project.selection
                .createFilteredSelection(box => box instanceof WarpMarkerBox, {
                    fx: adapter => adapter.box,
                    fy: vertex => project.boxAdapters.adapterFor(vertex.box, WarpMarkerBoxAdapter)
                }))
        terminator.ownAll(
            selection.catchupAndSubscribe({
                onSelected: (adapter: WarpMarkerBoxAdapter) => adapter.onSelected(),
                onDeselected: (adapter: WarpMarkerBoxAdapter) => adapter.onDeselected()
            }),
            ContextMenu.subscribe(canvas, collector => {
                const marker = capturing.captureEvent(collector.client)
                if (isNotNull(marker)) {
                    selection.deselectAll()
                    selection.select(marker)
                    collector.addItems(
                        MenuItem.default({
                            label: "Remove warp marker",
                            selectable: !marker.isAnchor
                        }).setTriggerProcedure(() => {
                            project.editing.modify(() => selection.selected()
                                .filter(marker => !marker.isAnchor)
                                .forEach(marker => marker.box.delete()))
                        }),
                        DebugMenus.debugBox(marker.box, true)
                    )
                }
            }),
            Events.subscribeDblDwn(canvas, event => {
                const marker = capturing.captureEvent(event)
                if (isNotNull(marker)) {
                    if (!marker.isAnchor) {
                        project.editing.modify(() => marker.box.delete())
                    }
                } else {
                    const rect = canvas.getBoundingClientRect()
                    const x = event.clientX - rect.left
                    const unit = snapping.xToUnitRound(x) - reader.offset
                    const adjacentWarpMarkers = WarpMarkerUtils.findAdjacent(unit, warpMarkers)
                    if (isNull(adjacentWarpMarkers)) {return}
                    const [left, right] = adjacentWarpMarkers
                    if (isNull(left) || isNull(right)) {return}
                    if (right.position - left.position < MIN_DISTANCE * 2) {return}
                    const clamped = clamp(unit, left.position + MIN_DISTANCE, right.position - MIN_DISTANCE)
                    const alpha = (clamped - left.position) / (right.position - left.position)
                    const seconds = left.seconds + alpha * (right.seconds - left.seconds)
                    project.editing.modify(() => WarpMarkerBox.create(project.boxGraph, UUID.generate(), box => {
                        box.owner.refer(warping.box.warpMarkers)
                        box.position.setValue(unit)
                        box.seconds.setValue(seconds)
                    }))
                }
            }),
            Events.subscribe(canvas, "keydown", (event) => {
                if (Keyboard.isDelete(event)) {
                    project.editing.modify(() => selection.selected()
                        .filter(marker => !marker.isAnchor)
                        .forEach(marker => marker.box.delete()))
                }
            }),
            Dragging.attach(canvas, startEvent => {
                const marker = capturing.captureEvent(startEvent)
                selection.deselectAll()
                if (isNull(marker)) {return Option.None}
                selection.select(marker)
                const [left, right] = WarpMarkerUtils.findAdjacent(marker.position, warpMarkers)
                if (isNull(left) && isNull(right)) {
                    console.warn("Broken warp-markers")
                    return Option.None
                }
                return Option.wrap({
                    update: (event: Dragging.Event) => {
                        const rect = canvas.getBoundingClientRect()
                        const x = event.clientX - rect.left
                        const unit = snapping.xToUnitRound(x) - reader.offset
                        const min = left?.position ?? Number.MIN_SAFE_INTEGER
                        const max = right?.position ?? Number.MAX_SAFE_INTEGER
                        const clamped = clamp(unit, min + MIN_DISTANCE, max - MIN_DISTANCE)
                        project.editing.modify(() => marker.box.position.setValue(clamped), false)
                    },
                    approve: () => project.editing.mark()
                })
            }))
        return terminator
    }
}