import css from "./AudioWarpMarkers.sass?inline"
import {Dragging, Html} from "@opendaw/lib-dom"
import {Lifecycle, Option, TAU, Terminator} from "@opendaw/lib-std"
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

export const AudioWrapMarkers = ({lifecycle, project, range, reader}: Construct) => {
    const optWarping = reader.warping
    const {editing} = project
    const markerRadius = 7
    return (
        <div className={className}>
            <canvas onInit={canvas => {
                const {requestUpdate} = lifecycle.own(new CanvasPainter(canvas, painter => {
                    const {context, actualHeight, devicePixelRatio} = painter
                    optWarping.ifSome(({warpMarkers}) => {
                        context.beginPath()
                        warpMarkers.forEach(warp => {
                            const unit = reader.offset + warp.time
                            const x = range.unitToX(unit) * devicePixelRatio
                            context.arc(x, actualHeight * 0.5, 7, 0.0, TAU)
                        })
                        context.fillStyle = Colors.orange.toString()
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
                    }),
                    Dragging.attach(canvas, startEvent => {
                        return optWarping.flatMap((adapter) => {
                            const rect = canvas.getBoundingClientRect()
                            const x = startEvent.clientX - rect.left
                            const u0 = range.xToUnit(x - markerRadius) - reader.offset
                            const u1 = range.xToUnit(x + markerRadius) - reader.offset
                            const index = adapter.warpMarkers.findIndex(warp => warp.time >= u0 && warp.time <= u1)
                            if (index === -1) {return Option.None}
                            return Option.wrap({
                                update: (event: Dragging.Event) => {
                                    const rect = canvas.getBoundingClientRect()
                                    const x = event.clientX - rect.left
                                    adapter.warpMarkers[index].time = range.xToUnit(x) - reader.offset
                                    editing.modify(() => adapter.warpMarkers = adapter.warpMarkers.slice(), false)
                                },
                                approve: () => editing.mark()
                            })
                        })
                    }, {})
                )
            }}/>
        </div>
    )
}