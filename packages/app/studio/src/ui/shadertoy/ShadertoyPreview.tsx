import css from "./ShadertoyPreview.sass?inline"
import {AnimationFrame, Events, Html} from "@opendaw/lib-dom"
import {
    asInstanceOf,
    byte,
    isAbsent,
    Lifecycle,
    Nullable,
    Terminable,
    Terminator,
    tryCatch,
    unitValue,
    UUID
} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {StudioService} from "@/service/StudioService"
import {ShadertoyRunner} from "@/ui/shadertoy/ShadertoyRunner"
import {ShadertoyBox} from "@opendaw/studio-boxes"
import {MidiData} from "@opendaw/lib-midi"
import {Colors} from "@opendaw/studio-enums"
import {ShadertoyMIDIOutput} from "@/ui/shadertoy/ShadertoyMIDIOutput"
import {Address} from "@opendaw/lib-box"

const className = Html.adoptStyleSheet(css, "ShadertoyPreview")

type Construct = {
    lifecycle: Lifecycle
    service: StudioService
}

export const ShadertoyPreview = ({lifecycle, service}: Construct) => {
    const output: HTMLElement = <p className="status"/>
    return (
        <div className={className}>
            <h1>Shadertoy</h1>
            <p>
                Write GLSL shaders to create visuals for your music. The editor supports <a
                href="https://shadertoy.com/" target="shadertoy">Shadertoy</a> compatible syntax.<br/>
                MIDI data is passed to the shader if you route a MIDI output to the <span
                style={{color: Colors.green.toString()}}>Shadertoy</span> MIDI device.
            </p>
            <div className="canvas-wrapper">
                <canvas onInit={canvas => {
                    const gl: Nullable<WebGL2RenderingContext> = canvas.getContext("webgl2")
                    if (isAbsent(gl)) {
                        output.textContent = "WebGL2 not supported"
                        return
                    }
                    const runner = new ShadertoyRunner(gl)
                    const shaderLifecycle = lifecycle.own(new Terminator())
                    lifecycle.ownAll(
                        service.project.rootBox.shadertoy.catchupAndSubscribe(({targetVertex}) => {
                            shaderLifecycle.terminate()
                            targetVertex.match({
                                none: () => {
                                    gl.clearColor(0.0, 0.0, 0.0, 0.0)
                                    gl.clear(gl.COLOR_BUFFER_BIT)
                                    output.textContent = "No code"
                                    return Terminable.Empty
                                },
                                some: (box) => {
                                    const {shaderCode, highres} = asInstanceOf(box, ShadertoyBox)
                                    return shaderCode.catchupAndSubscribe(code => {
                                        const {status, error} = tryCatch(() => runner.compile(code.getValue()))
                                        if (status === "failure") {
                                            output.textContent = String(error)
                                            return
                                        }
                                        output.textContent = "Running"
                                        runner.resetTime()
                                        const peaks = new Float32Array(4)
                                        shaderLifecycle.ownAll(
                                            AnimationFrame.add(() => {
                                                const scale = highres.getValue() ? devicePixelRatio : 1
                                                canvas.width = canvas.clientWidth * scale
                                                canvas.height = canvas.clientHeight * scale
                                                gl.viewport(0, 0, canvas.width, canvas.height)
                                                runner.setPeaks(peaks)
                                                runner.setPPQN(service.engine.position.getValue())
                                                runner.render()
                                            }),
                                            ShadertoyMIDIOutput.subscribe(message => MidiData.accept(message, {
                                                controller: (id: byte, value: unitValue) => runner.onMidiCC(id, value),
                                                noteOn: (note: byte, velocity: byte) => runner.onMidiNoteOn(note, velocity),
                                                noteOff: (note: byte) => runner.onMidiNoteOff(note)
                                            })),
                                            service.project.liveStreamReceiver
                                                .subscribeFloats(Address.compose(UUID.Lowest), (enginePeaks) =>
                                                    peaks.set(enginePeaks, 0))
                                        )
                                    })
                                }
                            })
                        }),
                        Events.subscribe(canvas, "click", async () => {
                            if (document.fullscreenElement) {
                                await document.exitFullscreen()
                            } else {
                                await canvas.requestFullscreen()
                            }
                        })
                    )
                }}/>
            </div>
            {output}
        </div>
    )
}