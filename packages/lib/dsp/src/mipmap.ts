import {int} from "@opendaw/lib-std"
import {FFT} from "./fft"

// TODO Test! Then create a receiver that accepts a SAB

export class WaveMipMap {
    readonly #buffer: SharedArrayBuffer
    readonly #tables: Float32Array[]

    constructor(fn: (x: number) => number, baseSize: int = 2048, levels: int = 8) {
        let total = 0
        for (let i = 0; i < levels; i++) {
            total += baseSize >>> i
        }
        this.#buffer = new SharedArrayBuffer(total * 4)
        this.#tables = []

        const baseReal = new Float32Array(baseSize)
        const baseImag = new Float32Array(baseSize)
        const real = new Float32Array(baseSize)
        const imag = new Float32Array(baseSize)

        for (let i = 0; i < baseSize; i++) {baseReal[i] = fn(i / baseSize)}

        const fft = new FFT(baseSize)
        fft.process(baseReal, baseImag)

        let offset = 0
        for (let l = 0; l < levels; l++) {
            const size = baseSize >>> l
            const half = size >>> 1
            const out = new Float32Array(this.#buffer, offset * 4, size)
            real.set(baseReal)
            imag.set(baseImag)
            real.fill(0.0, half, baseSize - half)
            imag.fill(0.0, half, baseSize - half)
            fft.process(real, imag)
            for (let i = 0; i < size; i++) {out[i] = real[i] / baseSize}
            this.#tables.push(out)
            offset += size
        }
    }

    get tables(): readonly Float32Array[] {return this.#tables}
}

export class Oscillator {
    readonly #wave: WaveMipMap
    readonly #sampleRate: number
    #phase = 0.0

    constructor(wave: WaveMipMap, sampleRate: number) {
        this.#wave = wave
        this.#sampleRate = sampleRate
    }

    process(freqs: Float32Array, out: Float32Array, fromIndex: int, toIndex: int): void {
        const sr = this.#sampleRate
        const nyquist = sr * 0.5
        const tables = this.#wave.tables
        const max = tables.length - 1
        let phase = this.#phase
        let i0 = -1
        let a: Float32Array = tables[0]
        let b: Float32Array = tables[0]
        for (let i = fromIndex; i < toIndex; i++) {
            const f = freqs[i]
            const ratio = Math.max(f / nyquist, 1e-9)
            const lf = Math.log2(ratio)
            const idx = Math.max(0, Math.min(max - 1, -lf | 0))
            const frac = -lf - Math.floor(-lf)
            if (idx !== i0) {
                i0 = idx
                const j0 = Math.min(idx, max)
                const j1 = Math.min(idx + 1, max)
                a = tables[j0]
                b = tables[j1]
            }
            const lenA = a.length
            const lenB = b.length
            const pa = phase % lenA
            const pb = phase % lenB
            const ia = pa | 0
            const ib = pb | 0
            const fa = pa - ia
            const fb = pb - ib
            const sa = a[ia] * (1.0 - fa) + a[(ia + 1) % lenA] * fa
            const sb = b[ib] * (1.0 - fb) + b[(ib + 1) % lenB] * fb
            out[i] = sa * (1.0 - frac) + sb * frac
            phase += f * lenA / sr
        }
        this.#phase = phase
    }
}
