import css from "./Display.sass?inline"
import {Html} from "@opendaw/lib-dom"
import {Arrays, Lifecycle, unitValue} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {DuckerDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {CanvasPainter} from "@/ui/canvas/painter"

const className = Html.adoptStyleSheet(css, "Display")

type Construct = {
    lifecycle: Lifecycle
    adapter: DuckerDeviceBoxAdapter
}

class DuckerComputer {
    static readonly #SLOPE_MULT: number = 10.0

    #depth: number = 1.0
    #slope: number = 0.0
    #symmetry: number = 0.0

    #pEx: number = 0.0
    #invS0: number = 0.0
    #invS1: number = 0.0

    set(depth: number, slope: number, symmetry: number): void {
        this.#depth = depth
        this.#slope = slope * DuckerComputer.#SLOPE_MULT
        this.#symmetry = symmetry

        this.#pEx = 2.0 ** Math.abs(this.#slope)
        this.#invS0 = 1.0 / this.#symmetry
        this.#invS1 = 1.0 / (1.0 - symmetry)
    }

    compute(input: unitValue): unitValue {
        const p = input - Math.floor(input)
        const x = this.#slope < 0.0 ? 1.0 - p : p
        if (x <= this.#symmetry) {
            return 1.0 - ((1.0 - x * this.#invS0) ** this.#pEx) * this.#depth
        } else {
            return (((1.0 - x) * this.#invS1) ** this.#pEx) * this.#depth - this.#depth + 1.0
        }
    }
}

export const Display = ({lifecycle, adapter}: Construct) => {
    const computer = new DuckerComputer()
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
                    context.strokeStyle = "hsla(200, 40%, 70%, 0.75)"
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
                        context.strokeStyle = `hsla(200, 40%, 70%, ${opacity})`
                        context.stroke(path)
                        path.lineTo(x1, actualHeight)
                        path.lineTo(x0, actualHeight)
                        context.fillStyle = `hsla(200, 40%, 70%, ${opacity * 0.1})`
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