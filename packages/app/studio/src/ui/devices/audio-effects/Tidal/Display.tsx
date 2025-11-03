import css from "./Display.sass?inline"
import {Html} from "@opendaw/lib-dom"
import {Arrays, Lifecycle} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {TidalDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {CanvasPainter} from "@/ui/canvas/painter"
import {TidalComputer} from "@opendaw/lib-dsp"

const className = Html.adoptStyleSheet(css, "Display")

type Construct = {
    lifecycle: Lifecycle
    adapter: TidalDeviceBoxAdapter
}

export const Display = ({lifecycle, adapter}: Construct) => {
    const computer = new TidalComputer()
    return (
        <div className={className}>
            <canvas onInit={canvas => {
                const {depth, slope, symmetry, offset, channelOffset} = adapter.namedParameter
                const uMin = -0.5
                const uMax = 1.5
                const painter = lifecycle.own(new CanvasPainter(canvas, painter => {
                    const {context, actualWidth, actualHeight, devicePixelRatio} = painter
                    const innerHeight = actualHeight - devicePixelRatio * 2
                    const xToValue = (x: number) => uMin + (x / actualWidth - uMin) * (uMax - uMin)
                    const valueToX = (value: number) => (value - uMin) / (uMax - uMin) * actualWidth
                    const valueToY = (value: number) => innerHeight - (innerHeight * value)
                    computer.set(depth.getValue(), slope.getValue(), symmetry.getValue())

                    // edges
                    const x0 = valueToX(0.0)
                    const x1 = valueToX(1.0)
                    const y0 = valueToY(0.0)
                    const y1 = valueToY(1.0)
                    context.beginPath()
                    context.moveTo(x0, y0)
                    context.lineTo(x0, y1)
                    context.moveTo(x1, y0)
                    context.lineTo(x1, y1)
                    context.setLineDash([3, 3])
                    context.strokeStyle = "hsla(200, 83%, 60%, 0.75)"
                    context.stroke()

                    const curve = (u0: number, u1: number, opacity: number, phaseOffset: number) => {
                        const ud = offset.getValue() / 360.0 + phaseOffset
                        const x0 = valueToX(u0)
                        const x1 = valueToX(u1)
                        const path = new Path2D()
                        path.moveTo(x0, valueToY(computer.compute(u0 + ud)))
                        for (let x = x0; x <= x1; x++) {
                            path.lineTo(x, valueToY(computer.compute(xToValue(x) + ud)))
                        }
                        context.strokeStyle = `hsla(200, 83%, 60%, ${opacity})`
                        context.stroke(path)
                        path.lineTo(x1, actualHeight)
                        path.lineTo(x0, actualHeight)
                        context.fillStyle = `hsla(200, 83%, 60%, ${opacity * 0.1})`
                        context.fill(path)
                    }

                    context.lineWidth = 2.0
                    context.setLineDash(Arrays.empty())

                    // Channel 0
                    curve(uMin, 0.0, 0.30, 0.0)
                    curve(0.0, 1.0, 0.90, 0.0)
                    curve(1.0, uMax, 0.30, 0.0)

                    // Channel 1
                    const channelPhase: number = channelOffset.getValue() / 360.0
                    curve(uMin, 0.0, 0.10, channelPhase)
                    curve(0.0, 1.0, 0.20, channelPhase)
                    curve(1.0, uMax, 0.10, channelPhase)
                }))
                lifecycle.ownAll(
                    depth.subscribe(painter.requestUpdate),
                    slope.subscribe(painter.requestUpdate),
                    symmetry.subscribe(painter.requestUpdate),
                    offset.subscribe(painter.requestUpdate),
                    channelOffset.subscribe(painter.requestUpdate)
                )
            }}/>
        </div>
    )
}