import css from "./ShadertoyEditor.sass?inline"
import {asInstanceOf, Lifecycle, UUID} from "@opendaw/lib-std"
import {Await, createElement} from "@opendaw/lib-jsx"
import {Events, Html} from "@opendaw/lib-dom"
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
    if (rootBox.shadertoy.isEmpty()) {
        console.debug("New Shader")
        editing.modify(() => rootBox.shadertoy
            .refer(ShadertoyBox.create(boxGraph, UUID.generate(), box => box.shaderCode.setValue(Example))))
    }
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
                    const compileAndRun = () => {
                        const code = editor.getValue()
                        const canvas = document.createElement("canvas")
                        const gl = canvas.getContext("webgl2")
                        if (gl) {
                            try {
                                const testRunner = new ShadertoyRunner(gl)
                                testRunner.compile(code)
                                testRunner.terminate()
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
                                return
                            }
                        }
                        monaco.editor.setModelMarkers(editor.getModel()!, "glsl", [])
                        editing.modify(() => {
                            if (rootBox.shadertoy.isEmpty()) {
                                rootBox.shadertoy
                                    .refer(ShadertoyBox.create(boxGraph, UUID.generate(), box => box.shaderCode.setValue(code)))
                            } else {
                                asInstanceOf(rootBox.shadertoy.targetVertex.unwrap(), ShadertoyBox).shaderCode.setValue(code)
                            }
                        })
                    }
                    lifecycle.ownAll(
                        Events.subscribe(container, "keydown", event => {
                            if (event.altKey && event.key === "Enter") {
                                compileAndRun()
                            } else if ((event.ctrlKey || event.metaKey) && allowed.includes(event.key.toLowerCase())) {
                                return // Let Monaco handle these
                            }
                            event.stopPropagation()
                        }, {capture: true}),
                        Events.subscribe(container, "keyup", event => {
                            if ((event.ctrlKey || event.metaKey) && allowed.includes(event.key.toLowerCase())) {
                                return // Let Monaco handle these
                            }
                            event.stopPropagation()
                        }),
                        Events.subscribe(container, "keypress", event => event.stopPropagation())
                    )
                    requestAnimationFrame(() => editor.focus())
                    return (
                        <div>
                            <header>
                                <Button lifecycle={lifecycle}
                                        onClick={compileAndRun}
                                        appearance={{tooltip: "Run script"}}>
                                    <span>Run (alt+enter)</span> <Icon symbol={IconSymbol.Play}/>
                                </Button>
                            </header>
                            {container}
                        </div>
                    )
                }}/>
        </div>
    )
}