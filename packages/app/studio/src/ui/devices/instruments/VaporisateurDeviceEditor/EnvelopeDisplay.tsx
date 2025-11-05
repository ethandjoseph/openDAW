import css from "./Display.sass?inline"
import {Html} from "@opendaw/lib-dom"
import {Lifecycle} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {CanvasPainter} from "@/ui/canvas/painter"
import {AutomatableParameterFieldAdapter} from "@opendaw/studio-adapters"

const className = Html.adoptStyleSheet(css, "EnvelopeDisplay")

type Construct = {
    lifecycle: Lifecycle
    sustain: AutomatableParameterFieldAdapter<number>
}

export const EnvelopeDisplay = ({lifecycle, sustain}: Construct) => {
    return (
        <canvas className={className} onInit={canvas => {
            const painter = lifecycle.own(new CanvasPainter(canvas, painter => {
                const {context, actualWidth, actualHeight, devicePixelRatio} = painter
                const padding = devicePixelRatio * 4
                const top = padding
                const bottom = actualHeight - padding
                const valueToY = (value: number) => bottom + (top - bottom) * value
                const adsr = (x: number, s: number): number => {
                    if (x < 0.25) {return x * 4.0}
                    if (x < 0.5) {return 1.0 - (x - 0.25) * 4.0 * (1.0 - s)}
                    if (x < 0.75) {return s}
                    return s * (1.0 - (x - 0.75) * 4.0)
                }
                const s = sustain.getControlledValue()
                context.lineWidth = devicePixelRatio
                const path = new Path2D()
                path.moveTo(0, valueToY(adsr(0, s)))
                for (let x = 1; x <= actualWidth; x++) {
                    path.lineTo(x, valueToY(adsr(x / actualWidth, s)))
                }
                context.strokeStyle = "hsla(200, 83%, 60%, 0.75)"
                context.stroke(path)
                path.lineTo(actualWidth, valueToY(0.0))
                path.lineTo(0, valueToY(0.0))
                context.fillStyle = "hsla(200, 83%, 60%, 0.08)"
                context.fill(path)
                context.beginPath()
                context.moveTo(actualWidth / 4, top)
                context.lineTo(actualWidth / 4, bottom)
                context.moveTo(actualWidth / 2, top)
                context.lineTo(actualWidth / 2, bottom)
                context.moveTo(actualWidth / 4 * 3, top)
                context.lineTo(actualWidth / 4 * 3, bottom)
                context.setLineDash([2, 2])
                context.strokeStyle = "hsla(200, 83%, 60%, 0.20)"
                context.stroke()
            }))
            lifecycle.own(sustain.catchupAndSubscribe(painter.requestUpdate))
        }}/>
    )
}