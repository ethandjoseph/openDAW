import css from "./ShadertoyPreview.sass?inline"
import {AnimationFrame, Events, Html} from "@opendaw/lib-dom"
import {
    asInstanceOf,
    byte,
    DefaultObservableValue,
    isAbsent,
    Lifecycle,
    Terminable,
    Terminator,
    tryCatch,
    unitValue
} from "@opendaw/lib-std"
import {createElement, Frag, replaceChildren} from "@opendaw/lib-jsx"
import {StudioService} from "@/service/StudioService"
import {ShadertoyRunner} from "@/ui/shadertoy/ShadertoyRunner"
import {ShadertoyBox} from "@opendaw/studio-boxes"
import {MidiData} from "@opendaw/lib-midi"
import {ShadertoyMIDIOutput} from "@/ui/shadertoy/ShadertoyMIDIOutput"
import {ShadertoyLogo} from "@/ui/devices/panel/ShadertoyLogo"

const className = Html.adoptStyleSheet(css, "ShadertoyPreview")

type Construct = {
    lifecycle: Lifecycle
    service: StudioService
}

const visible = new DefaultObservableValue(true)

export const ShadertoyPreview = ({lifecycle, service}: Construct) => {
    return (
        <div className={className} onInit={element => {
            replaceChildren(element, (
                <Frag>
                    <ShadertoyLogo onInit={element => {
                        lifecycle.own(Events.subscribeDblDwn(element, () => visible.setValue(!visible.getValue())))
                    }}/>
                    <canvas onInit={canvas => {
                        const gl = canvas.getContext("webgl2")
                        if (isAbsent(gl)) {
                            element.setAttribute("data-status", "WebGL2 not supported")
                            return
                        }
                        const runner = new ShadertoyRunner(gl)
                        const shaderLifecycle = lifecycle.own(new Terminator())
                        lifecycle.ownAll(
                            visible.catchupAndSubscribe(owner => canvas.classList.toggle("hidden", !owner.getValue())),
                            service.project.rootBox.shadertoy.catchupAndSubscribe(({targetVertex}) => {
                                shaderLifecycle.terminate()
                                targetVertex.match({
                                    none: () => {
                                        element.classList.add("hidden")
                                        return Terminable.Empty
                                    },
                                    some: (box) => {
                                        element.classList.remove("hidden")
                                        return asInstanceOf(box, ShadertoyBox).shaderCode.catchupAndSubscribe(code => {
                                            const {status, error} = tryCatch(() => runner.compile(code.getValue()))
                                            if (status === "failure") {
                                                element.setAttribute("data-status", String(error))
                                                return
                                            }
                                            element.removeAttribute("data-status")
                                            runner.resetTime()
                                            shaderLifecycle.ownAll(
                                                AnimationFrame.add(() => {
                                                    if (visible.getValue()) {
                                                        canvas.width = canvas.clientWidth * devicePixelRatio
                                                        canvas.height = canvas.clientHeight * devicePixelRatio
                                                        gl.viewport(0, 0, canvas.width, canvas.height)
                                                        runner.setPPQN(service.engine.position.getValue())
                                                        runner.render()
                                                    }
                                                }),
                                                ShadertoyMIDIOutput.subscribe(message => MidiData.accept(message, {
                                                    controller: (id: byte, value: unitValue) => runner.onMidiCC(id, value),
                                                    noteOn: (note: byte, velocity: byte) => runner.onMidiNoteOn(note, velocity),
                                                    noteOff: (note: byte) => runner.onMidiNoteOff(note)
                                                }))
                                            )
                                        })
                                    }
                                })
                            })
                        )
                    }}/>
                </Frag>
            ))
        }}>
        </div>
    )
}