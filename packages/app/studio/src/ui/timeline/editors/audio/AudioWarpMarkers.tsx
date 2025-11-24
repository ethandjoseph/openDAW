import css from "./AudioWarpMarkers.sass?inline"
import {Dragging, Events, Html} from "@opendaw/lib-dom"
import {isNotNull, isNull, Lifecycle, Nullable, Option, TAU, Terminator, UUID} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {AudioEventOwnerReader} from "@/ui/timeline/editors/EventOwnerReader"
import {Project, TimelineRange} from "@opendaw/studio-core"
import {Snapping} from "@/ui/timeline/Snapping"
import {CanvasPainter} from "@/ui/canvas/painter"
import {FilteredSelection, WarpMarkerBoxAdapter} from "@opendaw/studio-adapters"
import {WarpMarkerBox} from "@opendaw/studio-boxes"
import {ElementCapturing} from "@/ui/canvas/capturing"
import {ContextMenu} from "@/ui/ContextMenu"
import {MenuItem} from "@/ui/model/menu-item"
import {DebugMenus} from "@/ui/menu/debug"
import {EventCollection, ppqn} from "@opendaw/lib-dsp"

const className = Html.adoptStyleSheet(css, "AudioWrapMarkers")

type Construct = {
    lifecycle: Lifecycle
    project: Project
    range: TimelineRange
    snapping: Snapping
    reader: AudioEventOwnerReader
}

const findAdjacentWarpMarker = (position: ppqn,
                                warpMarkers: EventCollection<WarpMarkerBoxAdapter>)
    : Nullable<[WarpMarkerBoxAdapter, WarpMarkerBoxAdapter]> => {
    const left = warpMarkers.lowerEqual(position - 1)
    const right = warpMarkers.greaterEqual(position + 1)
    if (isNotNull(left) && isNotNull(right)) {
        return [left, right]
    } else {
        return null
    }
}

export const AudioWrapMarkers = ({lifecycle, project, range, snapping, reader}: Construct) => {
    const optWarping = reader.warping
    const markerRadius = 7
    const {boxGraph, editing} = project
    return (
        <div className={className}>
            <canvas onInit={canvas => {
                const {requestUpdate} = lifecycle.own(new CanvasPainter(canvas, painter => {
                    const {context, actualHeight, devicePixelRatio} = painter
                    optWarping.ifSome(({warpMarkers}) => {
                        // TODO optimise
                        warpMarkers.asArray().forEach(warp => {
                            const unit = reader.offset + warp.position
                            const x = range.unitToX(unit) * devicePixelRatio
                            context.beginPath()
                            context.arc(x, actualHeight * 0.5, markerRadius, 0.0, TAU)
                            context.fillStyle = warp.isSelected
                                ? `hsl(${reader.hue}, 60%, 80%)`
                                : `hsl(${reader.hue}, 60%, 60%)`
                            context.fill()
                        })
                    })
                }))
                const warpingLifeCycle = lifecycle.own(new Terminator())
                lifecycle.ownAll(
                    range.subscribe(requestUpdate),
                    reader.subscribeChange(requestUpdate),
                    optWarping.catchupAndSubscribe((optWarping) => {
                        warpingLifeCycle.terminate()
                        optWarping.ifSome(warping => {
                            const capturing = new ElementCapturing<WarpMarkerBoxAdapter>(canvas, {
                                capture: (x: number, _y: number): Nullable<WarpMarkerBoxAdapter> => {
                                    const u0 = range.xToUnit(x - markerRadius) - reader.offset
                                    const u1 = range.xToUnit(x + markerRadius) - reader.offset
                                    let closest: Nullable<{ marker: WarpMarkerBoxAdapter, distance: number }> = null
                                    for (const marker of warping.warpMarkers.iterateRange(u0, u1)) {
                                        const dx = x - range.unitToX(marker.position + reader.offset)
                                        const distance = Math.abs(dx)
                                        if (distance <= markerRadius) {
                                            if (closest === null) {
                                                closest = {marker, distance}
                                            } else if (closest.distance < distance) {
                                                closest.marker = marker
                                                closest.distance = distance
                                            }
                                        }
                                    }
                                    if (closest === null) {return null}
                                    return closest.marker
                                }
                            })
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
                                            MenuItem.default({label: "Remove warp marker"})
                                                .setTriggerProcedure(() =>
                                                    editing.modify(() =>
                                                        selection.selected().forEach(marker => marker.box.delete()))),
                                            DebugMenus.debugBox(marker.box, true)
                                        )
                                    }
                                }),
                                Events.subscribeDblDwn(canvas, event => {
                                    const marker = capturing.captureEvent(event)
                                    if (isNotNull(marker)) {
                                        editing.modify(() => marker.box.delete())
                                    } else {
                                        const rect = canvas.getBoundingClientRect()
                                        const x = event.clientX - rect.left
                                        const unit = snapping.xToUnitRound(x) - reader.offset
                                        const adjacentWarpMarkers = findAdjacentWarpMarker(unit, warping.warpMarkers)
                                        if (isNotNull(adjacentWarpMarkers)) {
                                            const [left, right] = adjacentWarpMarkers
                                            editing.modify(() => {
                                                const alpha = (unit - left.position) / (right.position - left.position)
                                                const seconds = left.seconds + alpha * (right.seconds - left.seconds)
                                                WarpMarkerBox.create(boxGraph, UUID.generate(), box => {
                                                    box.owner.refer(warping.box.warpMarkers)
                                                    box.position.setValue(unit)
                                                    box.seconds.setValue(seconds)
                                                })
                                            })
                                        }
                                    }
                                }),
                                Dragging.attach(canvas, startEvent => {
                                    const marker = capturing.captureEvent(startEvent)
                                    selection.deselectAll()
                                    if (isNull(marker)) {return Option.None}
                                    selection.select(marker)
                                    return Option.wrap({
                                        update: (event: Dragging.Event) => {
                                            const rect = canvas.getBoundingClientRect()
                                            const x = event.clientX - rect.left
                                            const unit = snapping.xToUnitRound(x) - reader.offset
                                            editing.modify(() => marker.box.position.setValue(unit), false)
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