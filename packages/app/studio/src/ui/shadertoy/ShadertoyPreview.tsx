import css from "./ShadertoyPreview.sass?inline"
import {AnimationFrame, Html} from "@opendaw/lib-dom"
import {
    asInstanceOf,
    byte,
    EmptyProcedure,
    isAbsent,
    Lifecycle,
    Procedure,
    Terminable,
    Terminator,
    tryCatch,
    unitValue
} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {StudioService} from "@/service/StudioService"
import {ShadertoyRunner} from "@/ui/shadertoy/ShadertoyRunner"
import {ShadertoyBox} from "@opendaw/studio-boxes"
import {MidiDevices} from "@opendaw/studio-core"
import {MidiData} from "@opendaw/lib-midi"
import {Colors} from "@opendaw/studio-enums"

const className = Html.adoptStyleSheet(css, "ShadertoyPreview")

type Construct = {
    lifecycle: Lifecycle
    service: StudioService
}

let procedure: Procedure<Uint8Array> = EmptyProcedure

MidiDevices.createSoftwareMIDIOutput(
    message => procedure(message), "openDAW Shadertoy Editor", "openDAW-shadertoy")

export const ShadertoyPreview = ({lifecycle, service}: Construct) => {
    const output: HTMLElement = <p className="status"/>
    return (
        <div className={className}>
            <h1>Shadertoy</h1>
            <p>
                Write GLSL shaders to create visuals for your music. The editor supports <a
                href="https://shadertoy.com/" target="shadertoy">Shadertoy</a> compatible syntax. Audio spectrum is
                available via iChannel0, and MIDI data arrives when you route a MIDI output to the <span
                style={{color: Colors.green.toString()}}>openDAW Shadertoy Editor</span>.
            </p>
            <code></code>
            <canvas onInit={canvas => {
                const gl = canvas.getContext("webgl2")
                if (isAbsent(gl)) {
                    output.textContent = "WebGL2 not supported"
                    return
                }
                const runner = new ShadertoyRunner(gl)
                const shaderLifecycle = lifecycle.own(new Terminator())
                lifecycle.ownAll(
                    Terminable.create(() => procedure = EmptyProcedure),
                    service.project.rootBox.shadertoy.catchupAndSubscribe(({targetVertex}) => {
                        shaderLifecycle.terminate()
                        targetVertex.match({
                            none: () => {
                                output.textContent = "No code"
                                return Terminable.Empty
                            },
                            some: (box) => {
                                return asInstanceOf(box, ShadertoyBox).shaderCode.catchupAndSubscribe(code => {
                                    const {status, error} = tryCatch(() => runner.compile(code.getValue()))
                                    if (status === "failure") {
                                        output.textContent = String(error)
                                        return
                                    }
                                    output.textContent = "Running"
                                    runner.resetTime()
                                    shaderLifecycle.own(AnimationFrame.add(() => {
                                        canvas.width = canvas.clientWidth * devicePixelRatio
                                        canvas.height = canvas.clientHeight * devicePixelRatio
                                        gl.viewport(0, 0, canvas.width, canvas.height)
                                        runner.render()
                                    }))
                                    procedure = message => MidiData.accept(message, {
                                        controller: (id: byte, value: unitValue) => runner.onMidiCC(id, value),
                                        noteOn: (note: byte, velocity: byte) => runner.onMidiNoteOn(note, velocity),
                                        noteOff: (note: byte) => runner.onMidiNoteOff(note)
                                    })
                                })
                            }
                        })
                    })
                )
            }}/>
            {output}
        </div>
    )
}