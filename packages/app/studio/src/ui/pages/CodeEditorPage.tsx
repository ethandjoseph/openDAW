import {Await, createElement, PageContext, PageFactory} from "@opendaw/lib-jsx"
import {Html} from "@opendaw/lib-dom"
import css from "./CodeEditorPage.sass?inline"
import {StudioService} from "@/service/StudioService.ts"
import {ThreeDots} from "@/ui/spinner/ThreeDots"

const className = Html.adoptStyleSheet(css, "CodeEditorPage")

type Monaco = typeof import("monaco-editor")

export const CodeEditorPage: PageFactory<StudioService> = ({}: PageContext<StudioService>) => {
    return (
        <div className={className}>
            <h1>CodeEditor</h1>
            <Await
                factory={() => Promise.all([
                    import("monaco-editor/esm/vs/editor/editor.api"),
                    import("monaco-editor/esm/vs/language/typescript/monaco.contribution")
                ]).then(([_]) => _)}
                failure={({retry, reason}) => (<p onclick={retry}>{reason}</p>)}
                loading={() => ThreeDots()}
                success={(monaco: Monaco) => {
                    self.MonacoEnvironment = {
                        getWorker(_id: string, label: string) {
                            if (label === "json")
                                return new Worker(new URL("monaco-editor/esm/vs/language/json/json.worker?worker", import.meta.url), {type: "module"})
                            if (label === "css" || label === "scss" || label === "less")
                                return new Worker(new URL("monaco-editor/esm/vs/language/css/css.worker?worker", import.meta.url), {type: "module"})
                            if (label === "html" || label === "handlebars" || label === "razor")
                                return new Worker(new URL("monaco-editor/esm/vs/language/html/html.worker?worker", import.meta.url), {type: "module"})
                            if (label === "typescript" || label === "javascript")
                                return new Worker(new URL("monaco-editor/esm/vs/language/typescript/ts.worker?worker", import.meta.url), {type: "module"})
                            return new Worker(new URL("monaco-editor/esm/vs/editor/editor.worker?worker", import.meta.url), {type: "module"})
                        }
                    } as any

                    monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true)
                    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                        target: monaco.languages.typescript.ScriptTarget.ES2020,
                        module: monaco.languages.typescript.ModuleKind.ESNext,
                        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.Classic,
                        allowJs: false,
                        checkJs: false,
                        strict: true,
                        jsx: monaco.languages.typescript.JsxEmit.Preserve
                    })

                    const container = (<div className="monaco-editor"/>)
                    const editor = monaco.editor.create(container, {
                        value: `// openDAW code editor (based on monaco-editor)
// your code won't be executed yet
openDAW.play()
`,
                        language: "typescript",
                        theme: "vs-dark",
                        automaticLayout: true
                    })
                    monaco.languages.typescript.typescriptDefaults.addExtraLib(
                        `
        declare namespace openDAW {
            function play(): void
            function stop(): void
        }
        `,
                        "ts:opendaw.d.ts"
                    )
                    requestAnimationFrame(() => editor.focus())
                    return container
                }}/>
        </div>
    )
}