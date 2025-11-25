import css from "./WarpMarkerEditor.sass?inline"
import {Events, Html} from "@opendaw/lib-dom"
import {Lifecycle, MutableObservableValue, Nullable, TAU, Terminator} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {AudioEventOwnerReader} from "@/ui/timeline/editors/EventOwnerReader"
import {Project, TimelineRange} from "@opendaw/studio-core"
import {Snapping} from "@/ui/timeline/Snapping"
import {CanvasPainter} from "@/ui/canvas/painter"
import {AudioWarpingBoxAdapter, TransientMarkerBoxAdapter} from "@opendaw/studio-adapters"
import {WheelScaling} from "@/ui/timeline/WheelScaling"
import {WarpMarkerEditing} from "@/ui/timeline/editors/audio/WarpMarkerEditing"
import {TransientMarkerUtils} from "@/ui/timeline/editors/audio/TransientMarkerUtils"

const className = Html.adoptStyleSheet(css, "AudioWrapMarkers")

type Construct = {
    lifecycle: Lifecycle
    project: Project
    range: TimelineRange
    snapping: Snapping
    reader: AudioEventOwnerReader
    hoverTransient: MutableObservableValue<Nullable<TransientMarkerBoxAdapter>>
}

export const WarpMarkerEditor = ({lifecycle, project, range, snapping, reader, hoverTransient}: Construct) => {
    const optWarping = reader.warping
    const markerRadius = 7
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
                                optWarping.ifSome((warping: AudioWarpingBoxAdapter) => {
                                    const capturing = TransientMarkerUtils.createCapturing(
                                        canvas, range, reader, warping.warpMarkers, warping.transientMarkers)
                                    warpingLifeCycle.ownAll(
                                        warping.subscribe(requestUpdate),
                                        WarpMarkerEditing.install(
                                            warping, project, canvas, range, snapping, reader, hoverTransient),
                                        Events.subscribe(canvas, "pointermove",
                                            event => hoverTransient.setValue(capturing.captureEvent(event))),
                                        Events.subscribe(canvas, "pointerout",
                                            () => hoverTransient.setValue(null))
                                    )
                                })
                            }))
                    }}/>
        </div>
    )
}