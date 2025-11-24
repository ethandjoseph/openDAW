import css from "./AudioEditorCanvas.sass?inline"
import {Lifecycle} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {TimelineRange} from "@opendaw/studio-core"
import {CanvasPainter} from "@/ui/canvas/painter.ts"
import {LoopableRegion} from "@opendaw/lib-dsp"
import {renderAudio} from "@/ui/timeline/renderer/audio.ts"
import {Snapping} from "@/ui/timeline/Snapping.ts"
import {renderTimeGrid} from "@/ui/timeline/editors/TimeGridRenderer.ts"
import {AudioEventOwnerReader} from "@/ui/timeline/editors/EventOwnerReader.ts"
import {installEditorMainBody} from "../EditorBody"
import {Html} from "@opendaw/lib-dom"

const className = Html.adoptStyleSheet(css, "AudioEditorCanvas")

type Construct = {
    lifecycle: Lifecycle
    range: TimelineRange
    snapping: Snapping
    reader: AudioEventOwnerReader
}

export const AudioEditorCanvas = ({lifecycle, range, snapping, reader}: Construct) => {
    const waveformCanvas: HTMLCanvasElement = <canvas tabIndex={-1}/>
    const painter = lifecycle.own(new CanvasPainter(waveformCanvas, painter => {
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
        renderAudio(context, range, reader.file, reader.warping, reader.gain, {top: 0, bottom: actualHeight},
            `hsl(${reader.hue}, ${60}%, 45%)`, pass.unwrap())
    }))
    lifecycle.ownAll(
        installEditorMainBody({element: waveformCanvas, range, reader}),
        reader.subscribeChange(painter.requestUpdate),
        range.subscribe(painter.requestUpdate),
        Html.watchResize(waveformCanvas, painter.requestUpdate)
    )
    return (
        <div className={className}>
            <div>TRANSIENTS</div>
            <div>WRAP MARKER</div>
            {waveformCanvas}
        </div>
    )
}