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

// FIREFOX WORKAROUND
;(() => {
    if (typeof document.caretPositionFromPoint !== "function") return
    const original = document.caretPositionFromPoint.bind(document)
    document.caretPositionFromPoint = (x: number, y: number) => {
        const clampedY = Math.min(y, window.innerHeight - 2)
        const clampedX = Math.min(x, window.innerWidth - 2)
        return original(Math.max(0, clampedX), Math.max(0, clampedY))
    }
})()