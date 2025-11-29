import css from "./ShadertoyPreview.sass?inline"
import {AnimationFrame, Html} from "@opendaw/lib-dom"
import {
    asInstanceOf,
    byte,
    EmptyProcedure,
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

const className = Html.adoptStyleSheet(css, "ShadertoyPreview")

type Construct = {
    lifecycle: Lifecycle
    service: StudioService
}

let procedure: Procedure<Uint8Array> = EmptyProcedure

MidiDevices.createSoftwareMIDIOutput(
    message => procedure(message), "OpenDAW Shadertoy Editor", "openDAW-Shadertoy")

export const ShadertoyPreview = ({lifecycle, service}: Construct) => {
    const output: HTMLElement = <p/>
    return (
        <div className={className}>
            <canvas onInit={canvas => {
                const gl = canvas.getContext("webgl2")!
                const runner = new ShadertoyRunner(gl)
                const shaderLifecycle = lifecycle.own(new Terminator())
                const ccValues = new Float32Array(128)
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
                                        runner.setMidiCC(ccValues)
                                        runner.render()
                                    }))
                                    procedure = message => {
                                        MidiData.accept(message, {
                                            controller: (id: byte, value: unitValue) => ccValues[id] = value
                                        })
                                    }
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