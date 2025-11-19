import css from "./Display.sass?inline"
import {Context2d, Html} from "@opendaw/lib-dom"
import {clampUnit, int, Lifecycle} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {CanvasPainter} from "@/ui/canvas/painter"
import {DattorroReverbDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {DisplayPaint} from "@/ui/devices/DisplayPaint"

const className = Html.adoptStyleSheet(css, "Display")

type Construct = {
    lifecycle: Lifecycle
    adapter: DattorroReverbDeviceBoxAdapter
    gridUV: { u: int, v: int }
}

export const Display = ({lifecycle, adapter, gridUV: {u, v}}: Construct) => {
    const {bandwidth, decay} = adapter.namedParameter
    return (
        <div className={className} style={{gridArea: `${v + 1}/${u + 1}/auto/span 4`}}>
            <canvas onInit={canvas => {
                const opacity = (x: number, a: number, s: number): number => clampUnit(a <= 0.5
                    ? 1.0 - x / (s + 2.0 * a * (1.0 - s))
                    : 1.0 + ((2.0 * a - 1.0) * (1.0 - s) - 1.0) * x)
                const canvasPainter = lifecycle.own(new CanvasPainter(canvas, painter => {
                    const {context, actualWidth, actualHeight} = painter
                    const decayValue = decay.getControlledValue()
                    context.strokeStyle = DisplayPaint.strokeStyle()
                    const cx = actualWidth * 0.5
                    const cy = actualHeight * 0.5
                    const numberOfBoxes = 32
                    const c = 0.08
                    let x = cx * (1.0 - bandwidth.getControlledValue())
                    let y = 0.0
                    for (let i = 0; i < numberOfBoxes; i++) {
                        x += (cx - x) * c
                        y += (cy - y) * c
                        const globalAlpha = opacity(i / numberOfBoxes, decayValue * 0.25, 0.1)
                        if (globalAlpha <= 0.0) {break}
                        context.globalAlpha = globalAlpha
                        Context2d.strokeRoundedRect(context, x, y, (cx - x) * 2.0, (cy - y) * 2.0, 3.0)
                    }
                }))
                lifecycle.ownAll(
                    bandwidth.subscribe(canvasPainter.requestUpdate),
                    decay.subscribe(canvasPainter.requestUpdate)
                )
                return canvasPainter
            }}/>
        </div>
    )
}