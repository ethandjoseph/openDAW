import css from "./TransientMarkerEditor.sass?inline"
import {Events, Html} from "@opendaw/lib-dom"
import {isNull, Iterables, Lifecycle, Terminator} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {AudioEventOwnerReader} from "@/ui/timeline/editors/EventOwnerReader"
import {Project, TimelineRange} from "@opendaw/studio-core"
import {Snapping} from "@/ui/timeline/Snapping"
import {CanvasPainter} from "@/ui/canvas/painter"
import {Colors} from "@opendaw/studio-enums"
import {WheelScaling} from "@/ui/timeline/WheelScaling"
import {TransientMarkerUtils} from "@/ui/timeline/editors/audio/TransientMarkerUtils"

const className = Html.adoptStyleSheet(css, "TransientMarkerEditor")

type Construct = {
    lifecycle: Lifecycle
    project: Project
    range: TimelineRange
    snapping: Snapping
    reader: AudioEventOwnerReader
}

export const TransientMarkerEditor = ({lifecycle, range, reader}: Construct) => {
    const optWarping = reader.warping
    return (
        <div className={className}>
            <canvas onInit={canvas => {
                const {requestUpdate} = lifecycle.own(new CanvasPainter(canvas, painter => {
                    const {context, actualHeight, devicePixelRatio} = painter
                    optWarping.ifSome(({transientMarkers, warpMarkers}) => {
                        context.beginPath()
                        const pairWise = Iterables.pairWise(warpMarkers.iterateFrom(range.unitMin - reader.offset))
                        for (const [left, right] of pairWise) {
                            if (isNull(left) || isNull(right)) {break}
                            if (left.position + reader.offset > range.unitMax) {break}
                            for (const transient of transientMarkers.iterateFrom(left.seconds)) {
                                const seconds = transient.position
                                if (seconds > right.seconds) {break}
                                const t = (seconds - left.seconds) / (right.seconds - left.seconds)
                                const unit = left.position + t * (right.position - left.position)
                                const x = range.unitToX(unit + reader.offset) * devicePixelRatio
                                context.moveTo(x, actualHeight * 0.85)
                                context.lineTo(x - 7, actualHeight * 0.50)
                                context.lineTo(x + 7, actualHeight * 0.50)
                            }
                        }
                        context.fillStyle = Colors.shadow.toString()
                        context.fill()
                    })
                }))
                const warpingTerminator = lifecycle.own(new Terminator())
                lifecycle.ownAll(
                    WheelScaling.install(canvas, range),
                    range.subscribe(requestUpdate),
                    reader.subscribeChange(requestUpdate),
                    optWarping.catchupAndSubscribe((optWarping) => {
                        warpingTerminator.terminate()
                        optWarping.ifSome(warping => {
                            const capturing = TransientMarkerUtils.createCapturing(canvas, range, reader, warping.warpMarkers, warping.transientMarkers, 7)
                            warpingTerminator.ownAll(
                                warping.subscribe(requestUpdate),
                                Events.subscribe(canvas, "pointerdown", event => console.debug(capturing.captureEvent(event)))
                            )
                        })
                    })
                )
            }}/>
        </div>
    )
}