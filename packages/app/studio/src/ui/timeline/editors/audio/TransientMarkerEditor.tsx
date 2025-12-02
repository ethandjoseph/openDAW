import css from "./TransientMarkerEditor.sass?inline"
import {Html} from "@opendaw/lib-dom"
import {Lifecycle, Nullable, ObservableValue, Terminator} from "@opendaw/lib-std"
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
                        const waveformOffset = reader.waveformOffset.getValue()
                        const markers = warpMarkers.asArray()
                        if (markers.length < 2) {return}
                        const first = markers[0]
                        const second = markers[1]
                        const secondLast = markers[markers.length - 2]
                        const last = markers[markers.length - 1]
                        // Rates in ppqn per second (inverse of waveform's seconds per ppqn)
                        const firstRate = (second.position - first.position) / (second.seconds - first.seconds)
                        const lastRate = (last.position - secondLast.position) / (last.seconds - secondLast.seconds)
                        const secondsToLocalUnit = (seconds: number): number => {
                            if (seconds < first.seconds) {
                                return first.position + (seconds - first.seconds) * firstRate
                            }
                            if (seconds > last.seconds) {
                                return last.position + (seconds - last.seconds) * lastRate
                            }
                            for (let i = 0; i < markers.length - 1; i++) {
                                const left = markers[i]
                                const right = markers[i + 1]
                                if (seconds >= left.seconds && seconds <= right.seconds) {
                                    const t = (seconds - left.seconds) / (right.seconds - left.seconds)
                                    return left.position + t * (right.position - left.position)
                                }
                            }
                            return last.position
                        }
                        for (const transient of transientMarkers.asArray()) {
                            const adjustedSeconds = transient.position - waveformOffset
                            const localUnit = secondsToLocalUnit(adjustedSeconds)
                            const unit = reader.offset + localUnit
                            if (unit < range.unitMin) {continue}
                            if (unit > range.unitMax) {break}
                            const x = range.unitToX(unit) * devicePixelRatio
                            context.beginPath()
                            context.moveTo(x, actualHeight * 0.85)
                            context.lineTo(x - 7, actualHeight * 0.50)
                            context.lineTo(x + 7, actualHeight * 0.50)
                            context.fillStyle = hoverTransient.getValue() === transient
                                ? Colors.white.toString()
                                : Colors.shadow.toString()
                            context.fill()
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