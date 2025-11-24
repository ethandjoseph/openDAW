import css from "./AudioTransientEditor.sass?inline"
import {Html} from "@opendaw/lib-dom"
import {Lifecycle, TAU} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {AudioEventOwnerReader} from "@/ui/timeline/editors/EventOwnerReader"
import {Project, TimelineRange} from "@opendaw/studio-core"
import {Snapping} from "@/ui/timeline/Snapping"
import {CanvasPainter} from "@/ui/canvas/painter"
import {Colors} from "@opendaw/studio-enums"

const className = Html.adoptStyleSheet(css, "AudioTransientEditor")

type Construct = {
    lifecycle: Lifecycle
    project: Project
    range: TimelineRange
    snapping: Snapping
    reader: AudioEventOwnerReader
}

export const AudioTransientEditor = ({lifecycle, project, range, snapping, reader}: Construct) => {
    const warping = reader.warping
    const {tempoMap} = project
    console.debug(warping.unwrapOrNull()?.warps)
    return (
        <div className={className}>
            <canvas onInit={canvas => {
                const {requestUpdate} = lifecycle.own(new CanvasPainter(canvas, painter => {
                    const {context, actualHeight, devicePixelRatio} = painter

                    if (warping.nonEmpty()) {
                        const startSeconds = tempoMap.ppqnToSeconds(reader.position)
                        context.beginPath()
                        warping.unwrap().transients.forEach(transient => {
                            const absolutePosition = startSeconds + transient
                            const unit = tempoMap.secondsToPPQN(absolutePosition)
                            const x = range.unitToX(unit) * devicePixelRatio
                            console.debug(absolutePosition, unit, x)
                            context.arc(x, actualHeight / 2, 7, 0.0, TAU)
                        })
                        context.fillStyle = Colors.blue.toString()
                        context.fill()
                    }
                }))
                lifecycle.ownAll(
                    range.subscribe(requestUpdate),
                    warping.catchupAndSubscribe(requestUpdate)
                )
            }}/>
        </div>
    )
}