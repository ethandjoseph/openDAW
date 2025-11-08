import {Await, createElement, PageContext, PageFactory} from "@opendaw/lib-jsx"
import {Html} from "@opendaw/lib-dom"
import css from "./CodeEditorPage.sass?inline"
import {StudioService} from "@/service/StudioService.ts"
import {ThreeDots} from "@/ui/spinner/ThreeDots"
import type {Monaco} from "./monacoSetup"

const className = Html.adoptStyleSheet(css, "CodeEditorPage")

export const CodeEditorPage: PageFactory<StudioService> = ({}: PageContext<StudioService>) => {
    return (
        <div className={className}>
            <h1>CodeEditor</h1>
            <Await
                factory={() => import("./monacoSetup").then(m => m.monaco)}
                failure={({retry, reason}) => (<p onclick={retry}>{reason}</p>)}
                loading={() => ThreeDots()}
                success={(monaco: Monaco) => {
                    const container = (<div className="monaco-editor"/>)

                    // Create a model first with a proper URI
                    const modelUri = monaco.Uri.parse('file:///main.ts')
                    const model = monaco.editor.createModel(
                        `// openDAW code editor (based on monaco-editor)
// your code won't be executed yet
openDAW.play()
`,
                        'typescript',
                        modelUri
                    )

                    const editor = monaco.editor.create(container, {
                        model: model,
                        theme: "vs-dark",
                        automaticLayout: true,
                        suggestOnTriggerCharacters: true,
                        quickSuggestions: true
                    })

                    requestAnimationFrame(() => editor.focus())
                    return container
                }}/>
        </div>
    )
}