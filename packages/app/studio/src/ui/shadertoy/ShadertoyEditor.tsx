import css from "./ShadertoyEditor.sass?inline"
import {
    asInstanceOf,
    Attempt,
    Attempts,
    EmptyProcedure,
    isAbsent,
    Lifecycle,
    RuntimeNotifier,
    Terminator,
    UUID
} from "@opendaw/lib-std"
import {Await, createElement} from "@opendaw/lib-jsx"
import {Events, Html, Keyboard} from "@opendaw/lib-dom"
import {Promises} from "@opendaw/lib-runtime"
import {IconSymbol} from "@opendaw/studio-enums"
import {ShadertoyBox} from "@opendaw/studio-boxes"
import {StudioService} from "@/service/StudioService"
import {ThreeDots} from "@/ui/spinner/ThreeDots"
import {Button} from "@/ui/components/Button"
import {Icon} from "@/ui/components/Icon"
import Example from "./example.glsl?raw"
import {ShadertoyRunner} from "@/ui/shadertoy/ShadertoyRunner"

const className = Html.adoptStyleSheet(css, "ShadertoyEditor")

type Construct = {
    lifecycle: Lifecycle
    service: StudioService
}

export const ShadertoyEditor = ({service, lifecycle}: Construct) => {
    const {project} = service
    const {boxGraph, editing, rootBox} = project
    return (
        <div className={className}>
            <Await
                factory={() => Promise.all([
                    Promises.guardedRetry(() => import("./monaco-setup"), (_error, count) => count < 10)
                        .then(({monaco}) => monaco)
                ])}
                failure={({retry, reason}) => (<p onclick={retry}>{reason}</p>)}
                loading={() => ThreeDots()}
                success={([monaco]) => {
                    const container = (<div className="monaco-editor"/>)
                    const modelUri = monaco.Uri.parse("file:///main.ts")
                    let model = monaco.editor.getModel(modelUri)
                    if (!model) {
                        const code = rootBox.shadertoy.targetVertex.mapOr((box) =>
                            asInstanceOf(box, ShadertoyBox).shaderCode.getValue(), Example)
                        model = monaco.editor.createModel(code, "glsl", modelUri)
                    }
                    const editor = monaco.editor.create(container, {
                        language: "glsl",
                        quickSuggestions: {
                            other: true,
                            comments: false,
                            strings: false
                        },
                        suggestOnTriggerCharacters: true,
                        acceptSuggestionOnCommitCharacter: true,
                        acceptSuggestionOnEnter: "on",
                        wordBasedSuggestions: "off",
                        model: model,
                        theme: "vs-dark",
                        automaticLayout: true
                    })
                    const allowed = ["c", "v", "x", "a", "z", "y"]
                    const canCompile = (code: string): Attempt<void, string> => {
                        const canvas = document.createElement("canvas")
                        const gl = canvas.getContext("webgl2")
                        if (isAbsent(gl)) {
                            return Attempts.err("Could not create webgl2 context")
                        }
                        try {
                            const testRunner = new ShadertoyRunner(gl)
                            testRunner.compile(code)
                            testRunner.terminate()
                            return Attempts.Ok
                        } catch (error) {
                            const match = /ERROR: \d+:(\d+): (.+)/.exec(String(error))
                            if (match) {
                                const lineNumber = parseInt(match[1], 10) - 9
                                monaco.editor.setModelMarkers(editor.getModel()!, "glsl", [{
                                    startLineNumber: lineNumber,
                                    startColumn: 1,
                                    endLineNumber: lineNumber,
                                    endColumn: 1000,
                                    message: match[2],
                                    severity: monaco.MarkerSeverity.Error
                                }])
                            }
                            return Attempts.err(String(error))
                        }
                    }
                    const saveShadertoyCode = (code: string) => {
                        editing.modify(() => {
                            if (rootBox.shadertoy.isEmpty()) {
                                rootBox.shadertoy
                                    .refer(ShadertoyBox.create(boxGraph, UUID.generate(), box => box.shaderCode.setValue(code)))
                            } else {
                                asInstanceOf(rootBox.shadertoy.targetVertex.unwrap(), ShadertoyBox).shaderCode.setValue(code)
                            }
                        })
                    }
                    const deleteShadertoyCode = () => {
                        editing.modify(() => {
                            if (rootBox.shadertoy.nonEmpty()) {
                                asInstanceOf(rootBox.shadertoy.targetVertex.unwrap(), ShadertoyBox).delete()
                            }
                        })
                    }
                    const compileAndRun = () => {
                        const code = editor.getValue()
                        if (!canCompile(code)) {return}
                        monaco.editor.setModelMarkers(editor.getModel()!, "glsl", [])
                        saveShadertoyCode(code)
                    }
                    const shadertoyLifecycle = lifecycle.own(new Terminator())
                    lifecycle.ownAll(
                        rootBox.shadertoy.catchupAndSubscribe(pointer => {
                            shadertoyLifecycle.terminate()
                            if (pointer.nonEmpty()) {
                                shadertoyLifecycle.own(asInstanceOf(rootBox.shadertoy.targetVertex.unwrap(), ShadertoyBox)
                                    .shaderCode.catchupAndSubscribe(owner => {
                                        const value = owner.getValue()
                                        if (value === "") {return}
                                        editor.setValue(value)
                                    }))
                            } else {
                                editor.setValue(Example)
                            }
                        }),
                        Events.subscribe(window, "keydown", event => {
                            if (Keyboard.isControlKey(event) && event.code === "KeyS") {
                                const code = editor.getValue()
                                const attempt = canCompile(code)
                                if (attempt.isFailure()) {
                                    RuntimeNotifier.info({headline: "Cannot Save", message: attempt.failureReason()})
                                        .then(EmptyProcedure, EmptyProcedure)
                                } else {
                                    saveShadertoyCode(code)
                                    service.projectProfileService.save().then(EmptyProcedure, EmptyProcedure)
                                }
                                event.preventDefault()
                            } else if (event.altKey && event.key === "Enter") {
                                compileAndRun()
                                event.preventDefault()
                                event.stopPropagation()
                            }
                        }, {capture: true}),
                        Events.subscribe(container, "keydown", event => {
                            if ((event.ctrlKey || event.metaKey) && allowed.includes(event.key.toLowerCase())) {
                                return // Let Monaco handle these
                            }
                            event.stopPropagation()
                        }),
                        Events.subscribe(container, "keyup", event => {
                            if ((event.ctrlKey || event.metaKey) && allowed.includes(event.key.toLowerCase())) {
                                return // Let Monaco handle these
                            }
                            event.stopPropagation()
                        }),
                        Events.subscribe(container, "keypress", event => event.stopPropagation())
                    )
                    return (
                        <div>
                            <header>
                                <Button lifecycle={lifecycle}
                                        onClick={compileAndRun}
                                        appearance={{tooltip: "Run script"}}>
                                    <span>Run (alt+enter)</span> <Icon symbol={IconSymbol.Play}/>
                                </Button>
                                <Button lifecycle={lifecycle}
                                        onClick={deleteShadertoyCode}
                                        appearance={{tooltip: "Delete script"}}>
                                    <span>Delete</span> <Icon symbol={IconSymbol.Delete}/>
                                </Button>
                            </header>
                            {container}
                        </div>
                    )
                }}/>
        </div>
    )
}