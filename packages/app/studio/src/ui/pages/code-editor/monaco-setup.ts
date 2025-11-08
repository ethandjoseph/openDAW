import * as monaco from "monaco-editor"
import "monaco-editor/esm/vs/language/typescript/monaco.contribution"
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker"
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker"
import openDAWApiSource from "@opendaw/studio-core/script/Api?raw"

self.MonacoEnvironment = {
    getWorker(_, label) {
        console.debug("getWorker:", _, label)
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

const declarations = openDAWApiSource
        .replace(/export /g, "") // Remove all 'export' keywords
        .replace(/import\s+{[^}]+}\s+from\s+[^\n]+/g, "") // Remove import statements
        .replace(/InstrumentFactories\.Keys/g, "keyof InstrumentMap") // Replace with keyof InstrumentMap
    + "\n\ndeclare const openDAW: Api;"

console.log("Monaco declarations:", declarations)

tsDefaults.addExtraLib(declarations, "ts:opendaw.d.ts")

export {monaco}
export type Monaco = typeof monaco