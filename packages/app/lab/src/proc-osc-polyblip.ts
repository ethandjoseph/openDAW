import {RenderQuantum} from "@opendaw/lib-dsp"
import {TAU} from "@opendaw/lib-std"

export class ProcOscPolyblip extends AudioWorkletProcessor {
    #phase: number = 0.0
    #frequency: number = 220.0

    process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
        const [[mono]] = outputs
        for (let i = 0; i < RenderQuantum; i++) {
            mono[i] = Math.sin(this.#phase * TAU)
            this.#phase += this.#frequency / sampleRate
        }
        return true
    }
}

registerProcessor("proc-osc-polyblip", ProcOscPolyblip)