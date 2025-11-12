import {Chord, Interpolation, PPQN} from "@opendaw/lib-dsp"
import {ApiImpl} from "./impl"

import {ScriptHostProtocol} from "./ScriptHostProtocol"

export class ScriptExecutor {
    readonly #api: Api

    constructor(protocol: ScriptHostProtocol) {this.#api = new ApiImpl(protocol)}

    async run(jsCode: string) {
        Object.assign(globalThis, {
            PPQN, Chord, Interpolation,
            openDAW: this.#api
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