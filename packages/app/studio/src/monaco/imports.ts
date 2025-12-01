import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker"
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker"

// noinspection JSUnusedGlobalSymbols
self.MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
        switch (label) {
            case "typescript":
            case "javascript":
                return new TsWorker()
            default:
                return new EditorWorker()
        }
    }
}