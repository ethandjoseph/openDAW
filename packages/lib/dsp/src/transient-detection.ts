import {BiquadCoeff} from "./biquad-coeff"
import {BiquadMono} from "./biquad-processor"
import {panic} from "@opendaw/lib-std"

export type AudioData = {
    sampleRate: number
    numberOfFrames: number
    numberOfChannels: number
    frames: ReadonlyArray<Float32Array>
}

// === Magic Constants ===
const LR_ORDER = 24 // Linkwitz-Riley filter order (12, 24, 48)
const LOW_CROSSOVER_HZ = 200.0
const HIGH_CROSSOVER_HZ = 2000.0
const RMS_WINDOW_MS = 10.0
const MIN_TRANSIENT_SEPARATION_MS = 120.0
const ENERGY_DERIVATIVE_THRESHOLD = 0.001
const MIN_TRANSIENT_COUNT = 8
const MAX_TRANSIENT_DENSITY_PER_SEC = 30.0

const BAND_WEIGHTS: Record<Band, number> = {
    low: 0.5,
    mid: 1.0,
    high: 2.0
}

type Band = "low" | "mid" | "high"

type BandBuffers = {
    low: Float32Array
    mid: Float32Array
    high: Float32Array
}

// === Linkwitz-Riley Filter ===
const applyLRFilter = (
    input: Float32Array,
    freq: number,
    sampleRate: number,
    type: "lowpass" | "highpass",
    order: number
): Float32Array => {
    const passes = order / 12 // LR12 = 1 pass, LR24 = 2 passes, LR48 = 4 passes
    const coeff = new BiquadCoeff()
    const cutoff = freq / sampleRate
    if (type === "lowpass") {
        coeff.setLowpassParams(cutoff, Math.SQRT1_2)
    } else {
        coeff.setHighpassParams(cutoff, Math.SQRT1_2)
    }
    let result = input
    for (let p = 0; p < passes; p++) {
        // Each LR stage is two cascaded Butterworth filters
        const filter1 = new BiquadMono()
        const filter2 = new BiquadMono()
        const temp1 = new Float32Array(result.length)
        const temp2 = new Float32Array(result.length)
        filter1.process(coeff, result, temp1, 0, result.length)
        filter2.process(coeff, temp1, temp2, 0, result.length)
        result = temp2
    }
    return result
}

const splitBands = (mono: Float32Array, sampleRate: number): BandBuffers => {
    const low = applyLRFilter(mono, LOW_CROSSOVER_HZ, sampleRate, "lowpass", LR_ORDER)
    const highFromLow = applyLRFilter(mono, LOW_CROSSOVER_HZ, sampleRate, "highpass", LR_ORDER)
    const mid = applyLRFilter(highFromLow, HIGH_CROSSOVER_HZ, sampleRate, "lowpass", LR_ORDER)
    const high = applyLRFilter(highFromLow, HIGH_CROSSOVER_HZ, sampleRate, "highpass", LR_ORDER)
    return {low, mid, high}
}

// === Mono Mixdown ===
const mixToMono = (audio: AudioData): Float32Array => {
    const {numberOfFrames, numberOfChannels, frames} = audio
    if (numberOfChannels === 0) {return panic("Invalid sample. No channels found.")}
    if (numberOfChannels === 1) {return new Float32Array(frames[0])}
    const mono = new Float32Array(numberOfFrames)
    for (let ch = 0; ch < numberOfChannels; ch++) {
        const channel = frames[ch]
        for (let i = 0; i < numberOfFrames; i++) {
            mono[i] += channel[i]
        }
    }
    const scale = 1.0 / numberOfChannels
    for (let i = 0; i < numberOfFrames; i++) {
        mono[i] *= scale
    }
    return mono
}

// === Energy Envelope ===
const computeEnergyEnvelope = (buffer: Float32Array, sampleRate: number): Float32Array => {
    const windowSamples = Math.floor((RMS_WINDOW_MS / 1000.0) * sampleRate)
    const halfWindow = Math.floor(windowSamples / 2)
    const envelope = new Float32Array(buffer.length)
    let sumSq = 0.0
    // Initialize window
    for (let i = 0; i < windowSamples && i < buffer.length; i++) {
        sumSq += buffer[i] * buffer[i]
    }
    for (let i = 0; i < buffer.length; i++) {
        const windowStart = i - halfWindow
        const windowEnd = i + halfWindow
        // Sliding window: remove old sample, add new sample
        if (windowStart > 0 && windowStart - 1 < buffer.length) {
            const old = buffer[windowStart - 1]
            sumSq -= old * old
        }
        if (windowEnd < buffer.length) {
            const next = buffer[windowEnd]
            sumSq += next * next
        }
        const count = Math.min(windowEnd, buffer.length - 1) - Math.max(windowStart, 0) + 1
        envelope[i] = Math.sqrt(Math.max(0.0, sumSq) / count)
    }
    return envelope
}

// === Onset Detection ===
type Onset = {
    position: number
    energy: number
}

const detectOnsets = (envelope: Float32Array): Onset[] => {
    let maxEnergy = 0.0
    for (let i = 0; i < envelope.length; i++) {
        if (envelope[i] > maxEnergy) {maxEnergy = envelope[i]}
    }
    const threshold = maxEnergy * ENERGY_DERIVATIVE_THRESHOLD
    const onsets: Onset[] = []
    for (let i = 1; i < envelope.length - 1; i++) {
        const derivative = envelope[i] - envelope[i - 1]
        const nextDerivative = envelope[i + 1] - envelope[i]
        if (derivative > threshold && derivative > nextDerivative) {
            onsets.push({position: i, energy: envelope[i]})
        }
    }
    return onsets
}

// === Sorted Transient Collection ===
const binarySearchInsertPosition = (arr: number[], value: number): number => {
    let lo = 0
    let hi = arr.length
    while (lo < hi) {
        const mid = (lo + hi) >>> 1
        if (arr[mid] < value) {
            lo = mid + 1
        } else {
            hi = mid
        }
    }
    return lo
}

const isTooClose = (arr: number[], position: number, minSeparation: number): boolean => {
    const idx = binarySearchInsertPosition(arr, position)
    // Check left neighbor
    if (idx > 0 && position - arr[idx - 1] < minSeparation) {
        return true
    }
    // Check right neighbor
    if (idx < arr.length && arr[idx] - position < minSeparation) {
        return true
    }
    return false
}

const insertSorted = (arr: number[], value: number): void => {
    const idx = binarySearchInsertPosition(arr, value)
    arr.splice(idx, 0, value)
}

const collectTransients = (
    onsets: Onset[],
    minSeparationSamples: number,
    durationSeconds: number
): number[] => {
    // Sort by energy descending
    const sorted = [...onsets].sort((a, b) => b.energy - a.energy)
    const collected: number[] = []
    const maxCount = Math.floor(durationSeconds * MAX_TRANSIENT_DENSITY_PER_SEC)
    for (const onset of sorted) {
        if (collected.length >= maxCount && collected.length >= MIN_TRANSIENT_COUNT) {
            break
        }
        if (!isTooClose(collected, onset.position, minSeparationSamples)) {
            insertSorted(collected, onset.position)
        }
    }
    return collected
}

export const detectTransients = (audio: AudioData): number[] => {
    const {sampleRate, numberOfFrames} = audio
    const minSeparationSamples = Math.floor((MIN_TRANSIENT_SEPARATION_MS / 1000.0) * sampleRate)
    const mono = mixToMono(audio)
    const bands = splitBands(mono, sampleRate)
    const allOnsets: Onset[] = []
    for (const band of ["low", "mid", "high"] as Band[]) {
        const buffer = bands[band]
        const envelope = computeEnergyEnvelope(buffer, sampleRate)
        const onsets = detectOnsets(envelope)
        const weight = BAND_WEIGHTS[band]
        for (const onset of onsets) {
            allOnsets.push({position: onset.position, energy: onset.energy * weight})
        }
    }
    const collected: number[] = [0, numberOfFrames]
    const sorted = [...allOnsets].sort((a, b) => b.energy - a.energy)
    const durationSeconds = numberOfFrames / sampleRate
    const maxCount = Math.floor(durationSeconds * MAX_TRANSIENT_DENSITY_PER_SEC)
    for (const onset of sorted) {
        if (collected.length >= maxCount + 2 && collected.length >= MIN_TRANSIENT_COUNT + 2) {
            break
        }
        if (!isTooClose(collected, onset.position, minSeparationSamples)) {
            insertSorted(collected, onset.position)
        }
    }
    return collected.map(x => x / sampleRate)
}