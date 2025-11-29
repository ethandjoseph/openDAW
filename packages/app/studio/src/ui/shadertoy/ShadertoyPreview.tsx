import css from "./ShadertoyPreview.sass?inline"
import {AnimationFrame, Html} from "@opendaw/lib-dom"
import {asInstanceOf, Lifecycle, Terminable, Terminator, tryCatch} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {StudioService} from "@/service/StudioService"
import {ShadertoyRunner} from "@/ui/shadertoy/ShadertoyRunner"
import {ShadertoyBox} from "@opendaw/studio-boxes"

const className = Html.adoptStyleSheet(css, "ShadertoyPreview")

type Construct = {
    lifecycle: Lifecycle
    service: StudioService
}

export const ShadertoyPreview = ({lifecycle, service}: Construct) => {
    const output: HTMLElement = <p/>
    return (
        <div className={className}>
            <canvas onInit={canvas => {
                const gl = canvas.getContext("webgl2")!
                const runner = new ShadertoyRunner(gl)
                const shaderLifecycle = lifecycle.own(new Terminator())
                lifecycle.ownAll(
                    service.project.rootBox.shadertoy.catchupAndSubscribe(({targetVertex}) => {
                        shaderLifecycle.terminate()
                        targetVertex.match({
                            none: () => {
                                output.textContent = "No code"
                                return Terminable.Empty
                            },
                            some: (box) => {
                                return asInstanceOf(box, ShadertoyBox).shaderCode.catchupAndSubscribe(code => {
                                    console.debug(code)
                                    const {status, error} = tryCatch(() => runner.compile(code.getValue()))
                                    if (status === "failure") {
                                        output.textContent = String(error)
                                        return
                                    }
                                    runner.resetTime()
                                    shaderLifecycle.own(AnimationFrame.add(() => {
                                        canvas.width = canvas.clientWidth * devicePixelRatio
                                        canvas.height = canvas.clientHeight * devicePixelRatio
                                        gl.viewport(0, 0, canvas.width, canvas.height)
                                        runner.render()
                                    }))
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