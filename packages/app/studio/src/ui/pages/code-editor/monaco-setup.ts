import * as monaco from "monaco-editor"
import "monaco-editor/esm/vs/language/typescript/monaco.contribution"
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker"
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker"
import declarations from "@opendaw/studio-scripting/api.declaration?raw"
import library from "@opendaw/studio-scripting?raw"

/*
TODO:
    * Dialogs or a console
    * Add openDAW.getCurrentProject() <- needs to be send to worker and changes should be revertable
    * Get selections (introduce await to talk back to main-thread?)
    * Start a script-editor with selected items and write boiler-plate code to start modifiying them (typed)
    * Save file for exporting
    * Store project in ProjectStorage
    * Add a way to query and set values in boxes (typed)
    * Add a way to query available samples and soundfonts
    * Add Clips
    -------------------------------------------------------------------
    This code above will not be exposed. The two slashes start the example.
    Everything you import here, must be exported in the Api and globals too.
*/

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
    noLib: true,
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

tsDefaults.addExtraLib(library, "file:///library.d.ts")
tsDefaults.addExtraLib(declarations, "ts:opendaw.d.ts")
tsDefaults.addExtraLib(`
declare const console: Console
declare const Math: Math
`, "ts:libs.d.ts")

export {monaco}
export type Monaco = typeof monaco