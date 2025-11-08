import * as monaco from "monaco-editor"
import "monaco-editor/esm/vs/language/typescript/monaco.contribution"
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker"
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker"

// CRITICAL: Set up worker environment with proper Vite worker imports
self.MonacoEnvironment = {
    getWorker(_, label) {
        if (label === "typescript" || label === "javascript") {
            return new TsWorker()
        }
        return new EditorWorker()
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
    noEmit: false,  // CHANGED: was true by default, must be false to emit
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

// Add openDAW type definitions
tsDefaults.addExtraLib(
    `declare namespace openDAW {
    function dialog(): void
}`,
    "ts:opendaw.d.ts"
)

export {monaco}
export type Monaco = typeof monaco