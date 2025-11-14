import css from "./CodeEditorPage.sass?inline"
import {Events, Html} from "@opendaw/lib-dom"
import {Await, createElement, PageContext, PageFactory, RouteLocation} from "@opendaw/lib-jsx"
import {StudioService} from "@/service/StudioService.ts"
import {ThreeDots} from "@/ui/spinner/ThreeDots"
import {Button} from "@/ui/components/Button"
import {Icon} from "@/ui/components/Icon"
import {IconSymbol} from "@opendaw/studio-enums"
import {RuntimeNotifier} from "@opendaw/lib-std"
import {ScriptExecutor} from "@/ui/pages/code-editor/script-executor"
import {MenuButton} from "@/ui/components/MenuButton"
import {MenuItem} from "@/ui/model/menu-item"

import ScriptSimple from "./code-editor/examples/simple.ts?raw"
import ScriptRetro from "./code-editor/examples/retro.ts?raw"
import ScriptAudioRegion from "./code-editor/examples/create-sample.ts?raw"
import ScriptNanoWavetable from "./code-editor/examples/nano-wavetable.ts?raw"
import ScriptStressTest from "./code-editor/examples/stress-test.ts?raw"

const truncateImports = (script: string) => script.substring(script.indexOf("//"))
const Examples = {
    Simple: truncateImports(ScriptSimple),
    Retro: truncateImports(ScriptRetro),
    AudioRegion: truncateImports(ScriptAudioRegion),
    NanoWavetable: truncateImports(ScriptNanoWavetable),
    StressTest: truncateImports(ScriptStressTest)
}

const className = Html.adoptStyleSheet(css, "CodeEditorPage")

export const CodeEditorPage: PageFactory<StudioService> = ({lifecycle, service}: PageContext<StudioService>) => {
    const executor = new ScriptExecutor(service)
    return (
        <div className={className}>
            <Await
                factory={() => Promise.all([
                    import("./code-editor/monaco-setup").then(({monaco}) => monaco)
                ])}
                failure={({retry, reason}) => (<p onclick={retry}>{reason}</p>)}
                loading={() => ThreeDots()}
                success={([monaco]) => {
                    const container = (<div className="monaco-editor"/>)
                    const modelUri = monaco.Uri.parse("file:///main.ts")
                    let model = monaco.editor.getModel(modelUri)
                    if (!model) {
                        model = monaco.editor.createModel(Examples.Simple, "typescript", modelUri)
                    }
                    const editor = monaco.editor.create(container, {
                        model: model,
                        theme: "vs-dark",
                        automaticLayout: true,
                        suggestOnTriggerCharacters: true,
                        quickSuggestions: true
                    })
                    const allowed = ["c", "v", "x", "a", "z", "y"]
                    lifecycle.ownAll(
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
                    requestAnimationFrame(() => editor.focus())
                    const clickHandler = async () => {
                        try {
                            const worker = await monaco.languages.typescript.getTypeScriptWorker()
                            const client = await worker(model.uri)
                            const semanticDiagnostics = await client.getSemanticDiagnostics(model.uri.toString())
                            const syntacticDiagnostics = await client.getSyntacticDiagnostics(model.uri.toString())
                            const allDiagnostics = [...semanticDiagnostics, ...syntacticDiagnostics]
                            if (allDiagnostics.length > 0) {
                                const errors = allDiagnostics.map(d => d.messageText).join("\n")
                                await RuntimeNotifier.info({
                                    headline: "Compilation Error",
                                    message: errors
                                })
                                return
                            }
                            const emitOutput = await client.getEmitOutput(model.uri.toString())
                            if (emitOutput.outputFiles.length > 0) {
                                const jsCode = emitOutput.outputFiles[0].text
                                    .replace(/^["']use strict["'];?/, "")
                                await executor.execute(jsCode, {
                                    sampleRate: service.audioContext.sampleRate
                                })
                            } else {
                                await RuntimeNotifier.info({
                                    headline: "Compiler Error",
                                    message: "No output files generated"
                                })
                            }
                        } catch (error) {
                            await RuntimeNotifier.info({
                                headline: "Compilation Error",
                                message: String(error)
                            })
                        }
                    }
                    return (
                        <div>
                            <header>
                                <Button lifecycle={lifecycle}
                                        onClick={() => RouteLocation.get().navigateTo("/")}
                                        appearance={{tooltip: "Exit editor"}}>
                                    <span>Exit</span> <Icon symbol={IconSymbol.Exit}/>
                                </Button>
                                <Button lifecycle={lifecycle}
                                        onClick={clickHandler}
                                        appearance={{tooltip: "Run script"}}>
                                    <span>Run</span> <Icon symbol={IconSymbol.Play}/>
                                </Button>
                                <MenuButton root={MenuItem.root()
                                    .setRuntimeChildrenProcedure(parent => parent
                                        .addMenuItem(...Object.entries(Examples)
                                            .map(([name, example]) => MenuItem.default({label: name})
                                                .setTriggerProcedure(() => model.setValue(example)))))}>
                                    <span>Examples</span>
                                </MenuButton>
                            </header>
                            {container}
                        </div>
                    )
                }}/>
        </div>
    )
}