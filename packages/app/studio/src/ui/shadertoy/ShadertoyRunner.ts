import {clamp, clampUnit, Terminable} from "@opendaw/lib-std"
import {gainToDb, PPQN} from "@opendaw/lib-dsp"

export class ShadertoyRunner implements Terminable {
    readonly #gl: WebGL2RenderingContext
    readonly #audioData = new Uint8Array(512 * 2)
    readonly #midiCCData = new Uint8Array(128)
    readonly #midiNoteData = new Uint8Array(128)
    readonly #noteVelocities: Array<Array<number>> = Array.from({length: 128}, () => [])

    #uniformLocations: {
        iResolution: WebGLUniformLocation | null
        iTime: WebGLUniformLocation | null
        iTimeDelta: WebGLUniformLocation | null
        iFrame: WebGLUniformLocation | null
        iBeat: WebGLUniformLocation | null
        iPeaks: WebGLUniformLocation | null
        iChannelResolution: WebGLUniformLocation | null
        iChannel0: WebGLUniformLocation | null
        iMidiCC: WebGLUniformLocation | null
        iMidiNotes: WebGLUniformLocation | null
    } = {
        iResolution: null,
        iTime: null,
        iTimeDelta: null,
        iFrame: null,
        iBeat: null,
        iPeaks: null,
        iChannelResolution: null,
        iChannel0: null,
        iMidiCC: null,
        iMidiNotes: null
    }

    #program: WebGLProgram | null = null
    #vao: WebGLVertexArrayObject | null = null
    #audioTexture: WebGLTexture | null = null
    #midiCCTexture: WebGLTexture | null = null
    #midiNoteTexture: WebGLTexture | null = null
    #startTime = 0.0
    #lastFrameTime = 0.0
    #frameCount = 0
    #beat = 0.0
    #peaks = new Float32Array(4) // [leftPeak, leftRMS, rightPeak, rightRMS]

    static readonly #VERTEX_SHADER = `#version 300 es
        in vec4 aPosition;
        void main() {
            gl_Position = aPosition;
        }
    `
    static readonly #FRAGMENT_PREFIX = `#version 300 es
        precision highp float;
        uniform vec3 iResolution;
        uniform float iBeat;
        uniform float iTime;
        uniform float iTimeDelta;
        uniform int iFrame;
        uniform vec4 iPeaks; // leftPeak, leftRMS, rightPeak, rightRMS
        uniform vec3 iChannelResolution[1];
        uniform sampler2D iChannel0;
        uniform sampler2D iMidiCC;
        uniform sampler2D iMidiNotes;
        out vec4 fragColor;
        float midiCC(int cc) {
            return texture(iMidiCC, vec2((float(cc) + 0.5) / 128.0, 0.5)).r;
        }
        float midiNote(int pitch) {
            return texture(iMidiNotes, vec2((float(pitch) + 0.5) / 128.0, 0.5)).r;
        }
    `
    static readonly #FRAGMENT_SUFFIX = `
        void main() {
            mainImage(fragColor, gl_FragCoord.xy);
            fragColor.a = 1.0;
        }
    `
    constructor(gl: WebGL2RenderingContext) {
        this.#gl = gl
        this.#initGeometry()
        this.#initAudioTexture()
        this.#initMidiCCTexture()
        this.#initMidiNoteTexture()
    }

    /**
     * Compiles and links a Shadertoy fragment shader.
     * @param fragmentSource The mainImage() function source code (Shadertoy format)
     */
    compile(fragmentSource: string): void {
        const gl = this.#gl
        if (this.#program) {
            gl.deleteProgram(this.#program)
            this.#program = null
        }
        while (gl.getError() !== gl.NO_ERROR) {}
        const vertexShader = this.#compileShader(gl.VERTEX_SHADER, ShadertoyRunner.#VERTEX_SHADER)
        const fullFragmentSource = ShadertoyRunner.#FRAGMENT_PREFIX + fragmentSource + ShadertoyRunner.#FRAGMENT_SUFFIX
        const fragmentShader = this.#compileShader(gl.FRAGMENT_SHADER, fullFragmentSource)
        this.#program = gl.createProgram()
        if (!this.#program) {
            throw new Error("Failed to create program")
        }
        gl.attachShader(this.#program, vertexShader)
        gl.attachShader(this.#program, fragmentShader)
        gl.linkProgram(this.#program)
        gl.deleteShader(vertexShader)
        gl.deleteShader(fragmentShader)
        if (!gl.getProgramParameter(this.#program, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(this.#program)
            gl.deleteProgram(this.#program)
            this.#program = null
            throw new Error(`Program linking failed: ${info}`)
        }
        this.#uniformLocations = {
            iResolution: gl.getUniformLocation(this.#program, "iResolution"),
            iTime: gl.getUniformLocation(this.#program, "iTime"),
            iTimeDelta: gl.getUniformLocation(this.#program, "iTimeDelta"),
            iFrame: gl.getUniformLocation(this.#program, "iFrame"),
            iBeat: gl.getUniformLocation(this.#program, "iBeat"),
            iPeaks: gl.getUniformLocation(this.#program, "iPeaks"),
            iChannelResolution: gl.getUniformLocation(this.#program, "iChannelResolution"),
            iChannel0: gl.getUniformLocation(this.#program, "iChannel0"),
            iMidiCC: gl.getUniformLocation(this.#program, "iMidiCC"),
            iMidiNotes: gl.getUniformLocation(this.#program, "iMidiNotes")
        }
    }

    /**
     * Sets the waveform data (row 1 of iChannel0).
     * @param data Up to 512 samples, -1.0 to 1.0 range
     */
    setWaveform(data: Float32Array): void {
        const length = Math.min(data.length, 512)
        for (let i = 0; i < length; i++) {
            this.#audioData[512 + i] = Math.floor(128.0 * (1.0 + clamp(data[i], -1.0, 1.0)))
        }
    }

    /**
     * Sets the spectrum/FFT data (row 1 of iChannel0).
     * @param data 512 in Float32Array
     * @param sampleRate Sample rate in Hz
     */
    setSpectrum(data: Float32Array, sampleRate: number): void {
        const minFreq = 20.0
        const maxFreq = 20000.0
        const nyquist = sampleRate / 2.0
        const numBins = data.length
        const binWidth = nyquist / numBins
        const ratio = maxFreq / minFreq
        for (let i = 0; i < 512; i++) {
            const t = i / 512.0
            const freq = minFreq * Math.pow(ratio, t)
            const bin = freq / binWidth
            const binLow = Math.floor(bin)
            const binHigh = Math.min(binLow + 1, numBins - 1)
            const frac = bin - binLow
            const valueLow = binLow > 0 ? data[binLow] : 0.0
            const valueHigh = data[binHigh]
            const value = valueLow + frac * (valueHigh - valueLow)
            const normalized = (gainToDb(value) + 60.0) / 60.0
            this.#audioData[i] = Math.floor(clampUnit(normalized) * 255.0)
        }
    }

    /**
     * Sets the beat position.
     * @param ppqn Position in PPQN ticks
     */
    setPPQN(ppqn: number): void {
        this.#beat = ppqn / PPQN.Quarter
    }

    /**
     * Sets stereo peak and RMS values.
     * @param peaks Float32Array with [leftPeak, leftRMS, rightPeak, rightRMS]
     */
    setPeaks(peaks: Float32Array): void {
        this.#peaks.set(peaks)
    }

    /**
     * Sets a MIDI CC value.
     * @param cc Controller number (0-127)
     * @param value Normalized value (0.0-1.0)
     */
    onMidiCC(cc: number, value: number): void {
        this.#midiCCData[cc] = Math.floor(value * 255.0)
    }

    /**
     * Handles a MIDI note on event.
     * @param pitch Note pitch (0-127)
     * @param velocity Normalized velocity (0.0-1.0)
     */
    onMidiNoteOn(pitch: number, velocity: number): void {
        this.#noteVelocities[pitch].push(velocity)
        this.#updateNoteData(pitch)
    }

    /**
     * Handles a MIDI note off event.
     * @param pitch Note pitch (0-127)
     */
    onMidiNoteOff(pitch: number): void {
        this.#noteVelocities[pitch].shift()
        this.#updateNoteData(pitch)
    }

    #updateNoteData(pitch: number): void {
        const velocities = this.#noteVelocities[pitch]
        if (velocities.length === 0) {
            this.#midiNoteData[pitch] = 0
        } else {
            const maxVelocity = Math.max(...velocities)
            this.#midiNoteData[pitch] = Math.floor(maxVelocity * 255.0)
        }
    }

    /**
     * Renders a single frame.
     * @param time Optional explicit time in seconds. If omitted, uses elapsed time since resetTime().
     */
    render(time?: number): void {
        const gl = this.#gl
        if (!this.#program) {
            return
        }
        const currentTime = time ?? (performance.now() / 1000.0 - this.#startTime)
        const timeDelta = currentTime - this.#lastFrameTime
        this.#lastFrameTime = currentTime
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
        gl.disable(gl.BLEND)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.#audioTexture)
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 512, 2, gl.RED, gl.UNSIGNED_BYTE, this.#audioData)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, this.#midiCCTexture)
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 128, 1, gl.RED, gl.UNSIGNED_BYTE, this.#midiCCData)
        gl.activeTexture(gl.TEXTURE2)
        gl.bindTexture(gl.TEXTURE_2D, this.#midiNoteTexture)
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 128, 1, gl.RED, gl.UNSIGNED_BYTE, this.#midiNoteData)
        gl.useProgram(this.#program)
        gl.uniform3f(this.#uniformLocations.iResolution, gl.drawingBufferWidth, gl.drawingBufferHeight, 1.0)
        gl.uniform1f(this.#uniformLocations.iTime, currentTime)
        gl.uniform1f(this.#uniformLocations.iTimeDelta, timeDelta)
        gl.uniform1i(this.#uniformLocations.iFrame, this.#frameCount)
        gl.uniform1f(this.#uniformLocations.iBeat, this.#beat)
        gl.uniform4fv(this.#uniformLocations.iPeaks, this.#peaks)
        gl.uniform3fv(this.#uniformLocations.iChannelResolution, [512.0, 2.0, 1.0])
        gl.uniform1i(this.#uniformLocations.iChannel0, 0)
        gl.uniform1i(this.#uniformLocations.iMidiCC, 1)
        gl.uniform1i(this.#uniformLocations.iMidiNotes, 2)
        gl.bindVertexArray(this.#vao)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        gl.bindVertexArray(null)
        this.#frameCount++
    }

    /**
     * Resets the time and frame counter.
     */
    resetTime(): void {
        this.#startTime = performance.now() / 1000.0
        this.#lastFrameTime = this.#startTime
        this.#frameCount = 0
    }

    /**
     * Cleans up WebGL resources.
     */
    terminate(): void {
        const gl = this.#gl
        if (this.#program) {
            gl.deleteProgram(this.#program)
            this.#program = null
        }
        if (this.#vao) {
            gl.deleteVertexArray(this.#vao)
            this.#vao = null
        }
        if (this.#audioTexture) {
            gl.deleteTexture(this.#audioTexture)
            this.#audioTexture = null
        }
        if (this.#midiCCTexture) {
            gl.deleteTexture(this.#midiCCTexture)
            this.#midiCCTexture = null
        }
        if (this.#midiNoteTexture) {
            gl.deleteTexture(this.#midiNoteTexture)
            this.#midiNoteTexture = null
        }
    }

    #initGeometry(): void {
        const gl = this.#gl
        const vertices = new Float32Array([
            -1.0, -1.0,
            1.0, -1.0,
            -1.0, 1.0,
            1.0, 1.0
        ])
        const vbo = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
        this.#vao = gl.createVertexArray()
        gl.bindVertexArray(this.#vao)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
        gl.bindVertexArray(null)
    }

    #initAudioTexture(): void {
        const gl = this.#gl
        this.#audioTexture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, this.#audioTexture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 512, 2, 0, gl.RED, gl.UNSIGNED_BYTE, this.#audioData)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    }

    #initMidiCCTexture(): void {
        const gl = this.#gl
        this.#midiCCTexture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, this.#midiCCTexture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 128, 1, 0, gl.RED, gl.UNSIGNED_BYTE, this.#midiCCData)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    }

    #initMidiNoteTexture(): void {
        const gl = this.#gl
        this.#midiNoteTexture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, this.#midiNoteTexture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 128, 1, 0, gl.RED, gl.UNSIGNED_BYTE, this.#midiNoteData)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    }

    #compileShader(type: number, source: string): WebGLShader {
        const gl = this.#gl
        const shader = gl.createShader(type)
        if (!shader) {
            throw new Error("Failed to create shader")
        }
        gl.shaderSource(shader, source)
        gl.compileShader(shader)
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader)
            gl.deleteShader(shader)
            throw new Error(`Shader compilation failed: ${info}`)
        }
        return shader
    }
}