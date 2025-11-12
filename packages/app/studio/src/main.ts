import "./main.sass"
import workersUrl from "@opendaw/studio-core/workers-main.js?worker&url"
import workletsUrl from "@opendaw/studio-core/processors.js?url"
import scriptWorkerUrl from "@opendaw/studio-scripting/ScriptWorker.js?worker&url"
import {boot} from "@/boot"
import {ScriptExecutor} from "@/ui/pages/code-editor/script-executor"

if (window.crossOriginIsolated) {
    const now = Date.now()
    ScriptExecutor.url = scriptWorkerUrl
    boot({workersUrl, workletsUrl}).then(() => console.debug(`Booted in ${Math.ceil(Date.now() - now)}ms`))
} else {
    alert("crossOriginIsolated is enabled")
}