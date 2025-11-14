import {Chord, Interpolation, PPQN} from "@opendaw/lib-dsp"
import {Api} from "./Api"
import {ApiImpl} from "./impl"
import {ScriptHostProtocol} from "./ScriptHostProtocol"
import {ScriptExecutionContext} from "./ScriptExecutionProtocol"

export class ScriptExecutor {
    readonly #api: Api

    constructor(protocol: ScriptHostProtocol) {this.#api = new ApiImpl(protocol)}

    async run(jsCode: string, context: ScriptExecutionContext) {
        Object.assign(globalThis, {
            ...context,
            openDAW: this.#api,
            PPQN, Chord, Interpolation
        })
        const blob = new Blob([jsCode], {type: "text/javascript"})
        const url = URL.createObjectURL(blob)
        try {
            await import(url)
        } finally {
            URL.revokeObjectURL(url)
        }
    }
}