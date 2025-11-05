import css from "./Display.sass?inline"
import {Html} from "@opendaw/lib-dom"
import {int, Lifecycle} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {CanvasPainter} from "@/ui/canvas/painter"
import {AutomatableParameterFieldAdapter, Vaporisateur} from "@opendaw/studio-adapters"
import {BiquadCoeff, gainToDb} from "@opendaw/lib-dsp"

const className = Html.adoptStyleSheet(css, "Display")

type Construct = {
    lifecycle: Lifecycle
    cutoff: AutomatableParameterFieldAdapter<number>
    resonance: AutomatableParameterFieldAdapter<number>
    order: AutomatableParameterFieldAdapter<int>
}

export const FilterDisplay = ({lifecycle, cutoff, resonance, order}: Construct) => {
    const coeff = new BiquadCoeff()
    return (
        <canvas className={className} onInit={canvas => {
            const painter = lifecycle.own(new CanvasPainter(canvas, painter => {
                const {context, actualWidth, actualHeight, devicePixelRatio} = painter
                const padding = devicePixelRatio * 4
                const top = padding
                const bottom = actualHeight - padding
                const minDb = -60.0
                const maxDb = +12.0
                const gainToY = (value: number) => bottom + (top - bottom) * (gainToDb(value) - minDb) / (maxDb - minDb)
                const sf = 48000
                coeff.setLowpassParams(cutoff.getControlledValue() / sf, resonance.getControlledValue())
                const frequency = new Float32Array(actualWidth)
                const magResponse = new Float32Array(actualWidth)
                const phaseResponse = new Float32Array(actualWidth)

                for (let x = 0; x < actualWidth; x++) {
                    const freq = Vaporisateur.CUTOFF_VALUE_MAPPING.y(x / actualWidth)
                    frequency[x] = freq / sf
                }

                coeff.getFrequencyResponse(frequency, magResponse, phaseResponse)

                context.lineWidth = devicePixelRatio
                const path = new Path2D()
                path.moveTo(0, gainToY(magResponse[0]))
                for (let x = 1; x < actualWidth; x++) {
                    const y = gainToY(magResponse[x])
                    if (y >= bottom) {break}
                    path.lineTo(x, y)
                }
                context.strokeStyle = "hsla(200, 83%, 60%, 0.75)"
                context.stroke(path)
                path.lineTo(actualWidth, bottom)
                path.lineTo(0, bottom)
                context.fillStyle = "hsla(200, 83%, 60%, 0.08)"
                context.fill(path)
                context.beginPath()
                context.setLineDash([2, 2])
                const zeroDbY = gainToY(1.0)
                context.moveTo(0, zeroDbY)
                context.lineTo(actualWidth, zeroDbY)
                context.strokeStyle = "hsla(200, 83%, 60%, 0.25)"
                context.stroke()
            }))
            lifecycle.ownAll(
                cutoff.catchupAndSubscribe(painter.requestUpdate),
                resonance.catchupAndSubscribe(painter.requestUpdate),
                order.catchupAndSubscribe(painter.requestUpdate)
            )
        }}/>
    )
}