import css from "./TransientMarkerEditor.sass?inline"
import {Html} from "@opendaw/lib-dom"
import {Iterables, Lifecycle, Nullable, ObservableValue, Terminator} from "@opendaw/lib-std"
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

export const TransientMarkerEditor = ({lifecycle, project, range, reader, hoverTransient}: Construct) => {
    const optWarping = reader.warping
    return (
        <div className={Html.buildClassList(className, "warping-aware")}>
            <canvas onInit={canvas => {
                const {requestUpdate} = lifecycle.own(new CanvasPainter(canvas, painter => {
                    const {context, actualHeight, devicePixelRatio} = painter
                    optWarping.ifSome(({transientMarkers, warpMarkers}) => {
                        const waveformOffset = reader.waveformOffset.getValue()
                        const first = warpMarkers.first()
                        const last = warpMarkers.last()
                        if (first === null || last === null) {return}
                        const tempoMap = project.tempoMap
                        const secondsToLocalUnit = (seconds: number): number => {
                            if (seconds < first.seconds) {
                                // Before first warp: extrapolate using tempoMap
                                const deltaPpqn = tempoMap.intervalToPPQN(seconds, first.seconds)
                                return first.position - deltaPpqn
                            }
                            if (seconds > last.seconds) {
                                // After last warp: extrapolate using tempoMap
                                const deltaPpqn = tempoMap.intervalToPPQN(last.seconds, seconds)
                                return last.position + deltaPpqn
                            }
                            // Within range: interpolate between warp markers
                            for (const [left, right] of Iterables.pairWise(warpMarkers.iterateFrom(0))) {
                                if (right === null) {break}
                                if (seconds >= left.seconds && seconds <= right.seconds) {
                                    const t = (seconds - left.seconds) / (right.seconds - left.seconds)
                                    return left.position + t * (right.position - left.position)
                                }
                            }
                            return last.position
                        }
                        for (const transient of transientMarkers.iterateFrom(0)) {
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