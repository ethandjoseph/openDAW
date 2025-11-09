import * as monaco from "monaco-editor"
import "monaco-editor/esm/vs/language/typescript/monaco.contribution"
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker"
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker"
import declarations from "@opendaw/studio-adapters/script/Declarations?raw"

// noinspection JSUnusedGlobalSymbols
self.MonacoEnvironment = {
    getWorker(_, label) {
        console.debug("getWorker:", _, label)
        return label === "typescript" || label === "javascript" ? new TsWorker() : new EditorWorker()
    }
}

// Configure TypeScript defaults
const tsDefaults = monaco.languages.typescript.typescriptDefaults

tsDefaults.setEagerModelSync(true)

tsDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    allowJs: true,
    checkJs: false,
    strict: true,
    jsx: monaco.languages.typescript.JsxEmit.Preserve,
    noEmit: false,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true
})

tsDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false,
    onlyVisible: false,
    diagnosticCodesToIgnore: []
})

tsDefaults.addExtraLib(declarations, "ts:opendaw.d.ts")

export {monaco}
export type Monaco = typeof monaco