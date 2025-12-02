import css from "./AudioEditorCanvas.sass?inline"
import {Lifecycle, Option, Terminator} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {Project, TimelineRange} from "@opendaw/studio-core"
import {CanvasPainter} from "@/ui/canvas/painter.ts"
import {EventCollection, LoopableRegion} from "@opendaw/lib-dsp"
import {renderAudio} from "@/ui/timeline/renderer/audio.ts"
import {Snapping} from "@/ui/timeline/Snapping.ts"
import {renderTimeGrid} from "@/ui/timeline/editors/TimeGridRenderer.ts"
import {AudioEventOwnerReader} from "@/ui/timeline/editors/EventOwnerReader.ts"
import {installEditorMainBody} from "../EditorBody"
import {Dragging, Html} from "@opendaw/lib-dom"
import {AudioPlayback} from "@opendaw/studio-enums"
import {WarpMarkerBoxAdapter} from "@opendaw/studio-adapters"

const className = Html.adoptStyleSheet(css, "AudioEditorCanvas")

type Construct = {
    lifecycle: Lifecycle
    project: Project
    range: TimelineRange
    snapping: Snapping
    reader: AudioEventOwnerReader
}

export const AudioEditorCanvas = ({lifecycle, project: {editing}, range, snapping, reader}: Construct) => {
    return (
        <div className={className}>
            <canvas tabIndex={-1} onInit={canvas => {
                const painter = lifecycle.own(new CanvasPainter(canvas, painter => {
                    const {context, actualHeight, devicePixelRatio} = painter

                    renderTimeGrid(context, range, snapping, 0, actualHeight)

                    // LOOP DURATION
                    const x0 = Math.floor(range.unitToX(reader.offset) * devicePixelRatio)
                    const x1 = Math.floor(range.unitToX(reader.offset + reader.loopDuration) * devicePixelRatio)
                    if (x0 > 0) {
                        context.fillStyle = `hsla(${reader.hue}, 60%, 60%, 0.30)`
                        context.fillRect(x0, 0, devicePixelRatio, actualHeight)
                    }
                    if (x1 > 0) {
                        context.fillStyle = `hsla(${reader.hue}, 60%, 60%, 0.03)`
                        context.fillRect(x0, 0, x1 - x0, actualHeight)
                        context.fillStyle = `hsla(${reader.hue}, 60%, 60%, 0.30)`
                        context.fillRect(x1, 0, devicePixelRatio, actualHeight)
                    }

                    const pass = LoopableRegion.locateLoop(reader, range.unitMin - range.unitPadding, range.unitMax)
                    if (pass.isEmpty()) {return}
                    renderAudio(context, range, reader.file,
                        reader.playback.getValue() === AudioPlayback.NoSync ? Option.None : reader.warping,
                        reader.waveformOffset.getValue(), reader.gain, {top: 0, bottom: actualHeight},
                        `hsl(${reader.hue}, ${60}%, 45%)`, pass.unwrap(), false)
                }))
                const warpingTerminator = lifecycle.own(new Terminator())
                const unitToSeconds = (ppqn: number, warpMarkers: EventCollection<WarpMarkerBoxAdapter>): number => {
                    const first = warpMarkers.first()
                    const last = warpMarkers.last()
                    if (first === null || last === null) {return 0.0}
                    // Before the first marker: extrapolate backwards
                    if (ppqn < first.position) {
                        const second = warpMarkers.greaterEqual(first.position + 1)
                        if (second === null) {return first.seconds}
                        const rate = (second.seconds - first.seconds) / (second.position - first.position)
                        return first.seconds + (ppqn - first.position) * rate
                    }
                    // After last marker: extrapolate forwards
                    if (ppqn > last.position) {
                        const secondLast = warpMarkers.lowerEqual(last.position - 1)
                        if (secondLast === null) {return last.seconds}
                        const rate = (last.seconds - secondLast.seconds) / (last.position - secondLast.position)
                        return last.seconds + (ppqn - last.position) * rate
                    }
                    // Within range: find bracketing markers directly
                    const w0 = warpMarkers.lowerEqual(ppqn)
                    const w1 = warpMarkers.greaterEqual(ppqn)
                    if (w0 === null || w1 === null) {return last.seconds}
                    if (w0.position === w1.position) {return w0.seconds}
                    const t = (ppqn - w0.position) / (w1.position - w0.position)
                    return w0.seconds + t * (w1.seconds - w0.seconds)
                }
                lifecycle.ownAll(
                    installEditorMainBody({element: canvas, range, reader}),
                    reader.subscribeChange(painter.requestUpdate),
                    reader.warping.catchupAndSubscribe((optWarping) => {
                        warpingTerminator.terminate()
                        optWarping.ifSome(warping => warpingTerminator.own(warping.subscribe(painter.requestUpdate)))
                    }),
                    range.subscribe(painter.requestUpdate),
                    Html.watchResize(canvas, painter.requestUpdate),
                    Dragging.attach(canvas, startEvent => {
                        const rect = canvas.getBoundingClientRect()
                        const startX = startEvent.clientX - rect.left
                        const startOffset = reader.waveformOffset.getValue()
                        const startPPQN = range.xToUnit(startX) - reader.offset  // clip-relative PPQN
                        const optWarping = reader.playback.getValue() === AudioPlayback.NoSync
                            ? Option.None
                            : reader.warping
                        // Compute the audio-seconds position under the cursor at drag start
                        const startAudioSeconds = optWarping.match({
                            none: () => {
                                // NoSync: linear mapping based on loop duration ratio
                                const audioDuration = reader.file.endInSeconds - reader.file.startInSeconds
                                const ratio = audioDuration / reader.loopDuration
                                return startPPQN * ratio + startOffset
                            },
                            some: ({warpMarkers}) => unitToSeconds(startPPQN, warpMarkers) + startOffset
                        })
                        return Option.wrap({
                            update: (event: Dragging.Event) => {
                                const currentX = event.clientX - rect.left
                                const currentPPQN = range.xToUnit(currentX) - reader.offset
                                const currentAudioSecondsWithoutOffset = optWarping.match({
                                    none: () => {
                                        const audioDuration = reader.file.endInSeconds - reader.file.startInSeconds
                                        const ratio = audioDuration / reader.loopDuration
                                        return currentPPQN * ratio
                                    },
                                    some: ({warpMarkers}) => unitToSeconds(currentPPQN, warpMarkers)
                                })
                                const newOffset = startAudioSeconds - currentAudioSecondsWithoutOffset
                                editing.modify(() => reader.waveformOffset.setValue(newOffset), false)
                            },
                            approve: () => editing.mark()
                        })
                    })
                )
            }}/>
        </div>
    )
}