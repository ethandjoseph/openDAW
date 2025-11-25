import css from "./TransientMarkerEditor.sass?inline"
import {Html} from "@opendaw/lib-dom"
import {Lifecycle, panic, Terminator} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {AudioEventOwnerReader} from "@/ui/timeline/editors/EventOwnerReader"
import {Project, TimelineRange} from "@opendaw/studio-core"
import {Snapping} from "@/ui/timeline/Snapping"
import {CanvasPainter} from "@/ui/canvas/painter"
import {Colors} from "@opendaw/studio-enums"
import {WarpMarkerBoxAdapter} from "@opendaw/studio-adapters"
import {ppqn} from "@opendaw/lib-dsp"

const className = Html.adoptStyleSheet(css, "TransientMarkerEditor")

type Construct = {
    lifecycle: Lifecycle
    project: Project
    range: TimelineRange
    snapping: Snapping
    reader: AudioEventOwnerReader
}

const secondsToUnit = (seconds: number, warpMarkers: ReadonlyArray<WarpMarkerBoxAdapter>): ppqn => {
    for (let i = 0; i < warpMarkers.length - 1; i++) {
        const current = warpMarkers[i]
        const next = warpMarkers[i + 1]
        if (seconds >= current.seconds && seconds <= next.seconds) {
            const t = (seconds - current.seconds) / (next.seconds - current.seconds)
            return current.position + t * (next.position - current.position)
        }
    }
    return panic("Broken Warp Markers: no warp marker found")
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
                        transientMarkers.asArray().forEach(transient => {
                            const unit = reader.offset + secondsToUnit(transient.position, warpMarkers.asArray())
                            const x = range.unitToX(unit) * devicePixelRatio
                            context.moveTo(x, actualHeight * 0.85)
                            context.lineTo(x - 7, actualHeight * 0.50)
                            context.lineTo(x + 7, actualHeight * 0.50)
                        })
                        context.fillStyle = Colors.shadow.toString()
                        context.fill()
                    })
                }))
                const warpingTerminator = lifecycle.own(new Terminator())
                lifecycle.ownAll(
                    range.subscribe(requestUpdate),
                    reader.subscribeChange(requestUpdate),
                    optWarping.catchupAndSubscribe((optWarping) => {
                        warpingTerminator.terminate()
                        optWarping.ifSome(warping => warpingTerminator.own(warping.subscribe(requestUpdate)))
                    })
                )
            }}/>
        </div>
    )
}