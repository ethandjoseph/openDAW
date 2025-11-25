import css from "./WarpMarkerEditor.sass?inline"
import {Dragging, Events, Html, Keyboard} from "@opendaw/lib-dom"
import {clamp, isNotNull, isNull, Lifecycle, Option, TAU, Terminator, UUID} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {AudioEventOwnerReader} from "@/ui/timeline/editors/EventOwnerReader"
import {Project, TimelineRange} from "@opendaw/studio-core"
import {Snapping} from "@/ui/timeline/Snapping"
import {CanvasPainter} from "@/ui/canvas/painter"
import {FilteredSelection, WarpMarkerBoxAdapter} from "@opendaw/studio-adapters"
import {WarpMarkerBox} from "@opendaw/studio-boxes"
import {ContextMenu} from "@/ui/ContextMenu"
import {MenuItem} from "@/ui/model/menu-item"
import {DebugMenus} from "@/ui/menu/debug"
import {PPQN} from "@opendaw/lib-dsp"
import {WarpMarkerCapturing} from "@/ui/timeline/editors/audio/WarpMarkerCapturing"
import {WarpMarkerUtils} from "@/ui/timeline/editors/audio/WarpMarkerUtils"
import {WheelScaling} from "@/ui/timeline/WheelScaling"

const className = Html.adoptStyleSheet(css, "AudioWrapMarkers")

type Construct = {
    lifecycle: Lifecycle
    project: Project
    range: TimelineRange
    snapping: Snapping
    reader: AudioEventOwnerReader
}

const MIN_DISTANCE = PPQN.SemiQuaver

export const WarpMarkerEditor = ({lifecycle, project, range, snapping, reader}: Construct) => {
    const optWarping = reader.warping
    const markerRadius = 7
    const {boxGraph, editing} = project
    return (
        <div className={className}>
            <canvas tabIndex={-1}
                    onInit={canvas => {
                        const {requestUpdate} = lifecycle.own(new CanvasPainter(canvas, painter => {
                            const {context, actualHeight, devicePixelRatio} = painter
                            optWarping.ifSome(({warpMarkers}) => {
                                for (const marker of warpMarkers.iterateFrom(range.unitMin - reader.offset)) {
                                    const unit = reader.offset + marker.position
                                    if (unit > range.unitMax) {break}
                                    const x = range.unitToX(unit) * devicePixelRatio
                                    context.beginPath()
                                    context.arc(x, actualHeight * 0.5, markerRadius, 0.0, TAU)
                                    context.fillStyle = marker.isSelected
                                        ? `hsl(${reader.hue}, 60%, 80%)`
                                        : `hsl(${reader.hue}, 60%, 50%)`
                                    context.fill()
                                }
                            })
                        }))
                        const warpingLifeCycle = lifecycle.own(new Terminator())
                        lifecycle.ownAll(
                            WheelScaling.install(canvas, range),
                            range.subscribe(requestUpdate),
                            reader.subscribeChange(requestUpdate),
                            optWarping.catchupAndSubscribe((optWarping) => {
                                warpingLifeCycle.terminate()
                                optWarping.ifSome(warping => {
                                    const {warpMarkers} = warping
                                    const capturing = WarpMarkerCapturing.create(
                                        canvas, range, reader, warpMarkers, markerRadius)
                                    const selection: FilteredSelection<WarpMarkerBoxAdapter> = warpingLifeCycle.own(
                                        project.selection
                                            .createFilteredSelection(box => box instanceof WarpMarkerBox, {
                                                fx: adapter => adapter.box,
                                                fy: vertex => project.boxAdapters.adapterFor(vertex.box, WarpMarkerBoxAdapter)
                                            }))
                                    warpingLifeCycle.ownAll(
                                        warping.subscribe(requestUpdate),
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
                                                        if (!marker.isAnchor) {
                                                            editing.modify(() =>
                                                                selection.selected().forEach(marker => marker.box.delete()))
                                                        }
                                                    }),
                                                    DebugMenus.debugBox(marker.box, true)
                                                )
                                            }
                                        }),
                                        Events.subscribeDblDwn(canvas, event => {
                                            const marker = capturing.captureEvent(event)
                                            if (isNotNull(marker)) {
                                                if (!marker.isAnchor) {
                                                    editing.modify(() => marker.box.delete())
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
                                                editing.modify(() => {
                                                    WarpMarkerBox.create(boxGraph, UUID.generate(), box => {
                                                        box.owner.refer(warping.box.warpMarkers)
                                                        box.position.setValue(unit)
                                                        box.seconds.setValue(seconds)
                                                    })
                                                })
                                            }
                                        }),
                                        Events.subscribe(canvas, "keydown", (event) => {
                                            if (Keyboard.isDelete(event)) {
                                                editing.modify(() => selection.selected()
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
                                                    editing.modify(() => marker.box.position.setValue(clamped), false)
                                                },
                                                approve: () => editing.mark()
                                            })
                                        })
                                    )
                                })
                            })
                        )
                    }}/>
        </div>
    )
}