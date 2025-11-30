import css from "./TransientMarkerEditor.sass?inline"
import {Html} from "@opendaw/lib-dom"
import {isNull, Iterables, Lifecycle, Nullable, ObservableValue, Terminator} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {AudioEventOwnerReader} from "@/ui/timeline/editors/EventOwnerReader"
import {Project, TimelineRange} from "@opendaw/studio-core"
import {Snapping} from "@/ui/timeline/Snapping"
import {CanvasPainter} from "@/ui/canvas/painter"
import {Colors} from "@opendaw/studio-enums"
import {WheelScaling} from "@/ui/timeline/WheelScaling"
import {TransientMarkerBoxAdapter} from "@opendaw/studio-adapters"

const className = Html.adoptStyleSheet(css, "TransientMarkerEditor")

type Construct = {
    lifecycle: Lifecycle
    project: Project
    range: TimelineRange
    snapping: Snapping
    reader: AudioEventOwnerReader
    hoverTransient: ObservableValue<Nullable<TransientMarkerBoxAdapter>>
}

export const TransientMarkerEditor = ({lifecycle, range, reader, hoverTransient}: Construct) => {
    const optWarping = reader.warping
    return (
        <div className={Html.buildClassList(className, "warping-aware")}>
            <canvas onInit={canvas => {
                const {requestUpdate} = lifecycle.own(new CanvasPainter(canvas, painter => {
                    const {context, actualHeight, devicePixelRatio} = painter
                    optWarping.ifSome(({transientMarkers, warpMarkers}) => {
                        const pairWise = Iterables.pairWise(warpMarkers.iterateFrom(range.unitMin - reader.offset))
                        for (const [left, right] of pairWise) {
                            if (isNull(left) || isNull(right)) {break}
                            if (left.position + reader.offset > range.unitMax) {break}
                            for (const transient of transientMarkers.iterateFrom(left.seconds)) {
                                const seconds = transient.position
                                if (seconds < left.seconds) {continue}
                                if (seconds > right.seconds) {break}
                                const alpha = (seconds - left.seconds) / (right.seconds - left.seconds)
                                const unit = left.position + alpha * (right.position - left.position)
                                const x = range.unitToX(unit + reader.offset) * devicePixelRatio
                                context.beginPath()
                                context.moveTo(x, actualHeight * 0.85)
                                context.lineTo(x - 7, actualHeight * 0.50)
                                context.lineTo(x + 7, actualHeight * 0.50)
                                context.fillStyle = hoverTransient.getValue() === transient
                                    ? Colors.white.toString()
                                    : Colors.shadow.toString()
                                context.fill()
                            }
                        }
                    })
                }))
                const warpingTerminator = lifecycle.own(new Terminator())
                lifecycle.ownAll(
                    WheelScaling.install(canvas, range),
                    range.subscribe(requestUpdate),
                    reader.subscribeChange(requestUpdate),
                    optWarping.catchupAndSubscribe((optWarping) => {
                        warpingTerminator.terminate()
                        optWarping.ifSome(warping => warpingTerminator.ownAll(
                            warping.subscribe(requestUpdate),
                            hoverTransient.subscribe(requestUpdate)
                        ))
                    })
                )
            }}/>
        </div>
    )
}