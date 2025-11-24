import css from "./AudioWarpMarkers.sass?inline"
import {Html} from "@opendaw/lib-dom"
import {Lifecycle, TAU} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {AudioEventOwnerReader} from "@/ui/timeline/editors/EventOwnerReader"
import {Project, TimelineRange} from "@opendaw/studio-core"
import {Snapping} from "@/ui/timeline/Snapping"
import {CanvasPainter} from "@/ui/canvas/painter"
import {Colors} from "@opendaw/studio-enums"

const className = Html.adoptStyleSheet(css, "AudioWrapMarkers")

type Construct = {
    lifecycle: Lifecycle
    project: Project
    range: TimelineRange
    snapping: Snapping
    reader: AudioEventOwnerReader
}

export const AudioWrapMarkers = ({lifecycle, range, reader}: Construct) => {
    const optWarping = reader.warping
    return (
        <div className={className}>
            <canvas onInit={canvas => {
                const {requestUpdate} = lifecycle.own(new CanvasPainter(canvas, painter => {
                    const {context, actualHeight, devicePixelRatio} = painter
                    optWarping.ifSome(({warps}) => {
                        context.beginPath()
                        warps.forEach(warp => {
                            const unit = reader.offset + warp.time
                            const x = range.unitToX(unit) * devicePixelRatio
                            context.arc(x, actualHeight * 0.5, 7, 0.0, TAU)
                        })
                        context.fillStyle = Colors.orange.toString()
                        context.fill()
                    })
                }))
                lifecycle.ownAll(
                    range.subscribe(requestUpdate),
                    optWarping.catchupAndSubscribe(requestUpdate)
                )
            }}/>
        </div>
    )
}