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
        <canvas className={className} onInit={canvas => {
            const {depth, slope, symmetry, offset, channelOffset} = adapter.namedParameter
            const painter = lifecycle.own(new CanvasPainter(canvas, painter => {
                const {context, actualWidth, actualHeight} = painter
                const uMin = -0.5
                const uMax = 1.5
                const xToValue = (x: number) => uMin + (x / actualWidth - uMin) * (uMax - uMin)
                const valueToX = (value: number) => (value - uMin) / (uMax - uMin) * actualWidth
                const valueToY = (value: number) => actualHeight - (actualHeight * value)
                computer.set(depth.getValue(), slope.getValue(), symmetry.getValue())

                const x0 = valueToX(0.0)
                const x1 = valueToX(1.0)
                const y0 = valueToY(0.0)
                const y1 = valueToY(1.0)
                context.fillStyle = "hsla(200, 40%, 70%, 0.08)"
                context.fillRect(x0, y0, x1 - x0, y1 - y0)

                context.lineWidth = 2.0

                const drawCurve = (color: string, phaseOffset: number = 0.0) => {
                    context.beginPath()
                    context.setLineDash(Arrays.empty())
                    const phase = offset.getValue() / 360.0 + phaseOffset
                    context.moveTo(0, valueToY(computer.compute(xToValue(0.0) + phase)))
                    for (let x = 0; x <= actualWidth; x++) {
                        const y = valueToY(computer.compute(xToValue(x) + phase))
                        context.lineTo(x, y)
                    }
                    context.strokeStyle = color
                    context.stroke()
                }
                drawCurve("hsla(200, 40%, 70%, 0.90)", 0.0)
                drawCurve("hsla(200, 40%, 70%, 0.20)", channelOffset.getValue() / 360.0)
            }))
            lifecycle.ownAll(
                depth.subscribe(painter.requestUpdate),
                slope.subscribe(painter.requestUpdate),
                symmetry.subscribe(painter.requestUpdate),
                offset.subscribe(painter.requestUpdate),
                channelOffset.subscribe(painter.requestUpdate)
            )
        }}/>
    )
}