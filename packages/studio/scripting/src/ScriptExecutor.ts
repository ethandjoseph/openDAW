import {RuntimeNotifier} from "@opendaw/lib-std"
import {Chord, Interpolation, PPQN} from "@opendaw/lib-dsp"
import {ApiImpl} from "./impl"

import {ScriptHostProtocol} from "./ScriptHostProtocol"

export class ScriptExecutor {
    readonly #api: Api

    constructor(protocol: ScriptHostProtocol) {this.#api = new ApiImpl(protocol)}

    async run(jsCode: string) {
        console.debug("Compiled JavaScript:")
        console.debug(jsCode)
        try {
            const globals = {
                PPQN, Chord, Interpolation,
                openDAW: this.#api
            }
            Object.assign(globalThis, globals)
            const blob = new Blob([jsCode], {type: "text/javascript"})
            const url = URL.createObjectURL(blob)
            try {
                await import(url)
                console.debug("Script executed successfully")
            } finally {
                URL.revokeObjectURL(url)
            }
        } catch (execError) {
            console.warn(execError)
            await RuntimeNotifier.info({
                headline: "Runtime Error",
                message: String(execError)
            })
        }
    }
}