import css from "./CompressionCurve.sass?inline"
import {Html} from "@opendaw/lib-dom"
import {Lifecycle} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {CompressorDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {CanvasPainter} from "@/ui/canvas/painter"
import {Vertical} from "@/ui/devices/audio-effects/CompressorDeviceEditor/Vertical"
import {GainComputer} from "@opendaw/lib-dsp/ctagdrc"

const className = Html.adoptStyleSheet(css, "CompressionCurve")

type Construct = {
    lifecycle: Lifecycle
    adapter: CompressorDeviceBoxAdapter
}

export const CompressionCurve = ({lifecycle, adapter}: Construct) => {
    const {padding, innerHeight: size, scale} = Vertical
    const {threshold, ratio, knee} = adapter.namedParameter
    const numSegments = 7
    const computer = new GainComputer()
    return (
        <div className={className}>
            <canvas onInit={canvas => {
                const canvasPainter = lifecycle.own(new CanvasPainter(canvas, painter => {
                    const {context, devicePixelRatio} = painter
                    context.scale(devicePixelRatio, devicePixelRatio)
                    context.translate(padding, padding)
                    context.save()
                    context.lineWidth = 0.0
                    context.beginPath()
                    for (let i = 0; i <= numSegments; i++) {
                        const pos = (i / numSegments) * size
                        context.moveTo(pos, 0)
                        context.lineTo(pos, size)
                        context.moveTo(0, pos)
                        context.lineTo(size, pos)
                    }
                    context.strokeStyle = "rgba(255, 255, 255, 0.03)"
                    context.stroke()

                    const drawPath = (x0: number, x1: number): void => {
                        const path2D = new Path2D()
                        for (let x = x0; x <= x1; x++) {
                            const db = scale.normToUnit(1.0 - x / size)
                            const cp = computer.applyCompression(-db) - db
                            const y = Math.min(scale.unitToNorm(-cp) * size, size)
                            if (x === 0) {
                                path2D.moveTo(x, y)
                            } else {
                                path2D.lineTo(x, y)
                            }
                        }
                        context.fillStyle = "hsla(200, 83%, 60%, 0.08)"
                        context.strokeStyle = "hsla(200, 83%, 60%, 0.80)"
                        context.stroke(path2D)
                        path2D.lineTo(x1, size)
                        path2D.lineTo(x0, size)
                        path2D.closePath()
                        context.fill(path2D)
                    }
                    drawPath(0, size)
                    const kneeValue = knee.getValue()
                    if (kneeValue > 0.0) {
                        const thresholdValue = threshold.getValue()
                        const x0 = (1.0 - scale.unitToNorm(-thresholdValue + kneeValue * 0.5)) * size
                        const x1 = (1.0 - scale.unitToNorm(-thresholdValue - kneeValue * 0.5)) * size
                        drawPath(x0, x1)
                    }
                    context.restore()
                }))
                lifecycle.ownAll(
                    threshold.catchupAndSubscribe(owner => {
                        computer.setThreshold(owner.getValue())
                        canvasPainter.requestUpdate()
                    }),
                    ratio.catchupAndSubscribe(owner => {
                        computer.setRatio(owner.getValue())
                        canvasPainter.requestUpdate()
                    }),
                    knee.catchupAndSubscribe(owner => {
                        computer.setKnee(owner.getValue())
                        canvasPainter.requestUpdate()
                    })
                )
                return canvasPainter
            }}/>
        </div>
    )
}