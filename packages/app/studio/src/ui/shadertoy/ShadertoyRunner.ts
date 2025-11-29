import {Terminable} from "@opendaw/lib-std"

export class ShadertoyRunner implements Terminable {
    readonly #gl: WebGL2RenderingContext
    readonly #audioData = new Uint8Array(512 * 2)
    readonly #midiData = new Uint8Array(128)

    #program: WebGLProgram | null = null
    #vao: WebGLVertexArrayObject | null = null
    #audioTexture: WebGLTexture | null = null
    #midiTexture: WebGLTexture | null = null
    #startTime = 0.0
    #lastFrameTime = 0.0
    #frameCount = 0
    #uniformLocations: {
        iResolution: WebGLUniformLocation | null
        iTime: WebGLUniformLocation | null
        iTimeDelta: WebGLUniformLocation | null
        iFrame: WebGLUniformLocation | null
        iChannelResolution: WebGLUniformLocation | null
        iChannel0: WebGLUniformLocation | null
        iMidiCC: WebGLUniformLocation | null
    } = {
        iResolution: null,
        iTime: null,
        iTimeDelta: null,
        iFrame: null,
        iChannelResolution: null,
        iChannel0: null,
        iMidiCC: null
    }
    static readonly #VERTEX_SHADER = `#version 300 es
        in vec4 aPosition;
        void main() {
            gl_Position = aPosition;
        }
    `
    static readonly #FRAGMENT_PREFIX = `#version 300 es
        precision highp float;
        uniform vec3 iResolution;
        uniform float iTime;
        uniform float iTimeDelta;
        uniform int iFrame;
        uniform vec3 iChannelResolution[1];
        uniform sampler2D iChannel0;
        uniform sampler2D iMidiCC;
        out vec4 fragColor;
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
        this.#initMidiTexture()
    }

    /**
     * Compiles and links a Shadertoy fragment shader.
     * @param fragmentSource The mainImage() function source code (Shadertoy format)
     */
    compile(fragmentSource: string): void {
        const gl = this.#gl
        if (this.#program) {
            gl.deleteProgram(this.#program)
        }
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
            iChannelResolution: gl.getUniformLocation(this.#program, "iChannelResolution"),
            iChannel0: gl.getUniformLocation(this.#program, "iChannel0"),
            iMidiCC: gl.getUniformLocation(this.#program, "iMidiCC")
        }
    }

    /**
     * Sets the waveform data (row 0 of iChannel0).
     * @param data Up to 512 samples, normalized 0-255 for Uint8Array or 0.0-1.0 for Float32Array
     */
    setWaveform(data: Uint8Array | Float32Array): void {
        const length = Math.min(data.length, 512)
        if (data.BYTES_PER_ELEMENT === 4) {
            for (let i = 0; i < length; i++) {
                this.#audioData[i] = Math.floor(data[i] * 255.0)
            }
        } else {
            this.#audioData.set(data.subarray(0, length), 0)
        }
    }

    /**
     * Sets the spectrum/FFT data (row 1 of iChannel0).
     * @param data Up to 512 samples, normalized 0-255 for Uint8Array or 0.0-1.0 for Float32Array
     */
    setSpectrum(data: Uint8Array | Float32Array): void {
        const length = Math.min(data.length, 512)
        if (data.BYTES_PER_ELEMENT === 4) {
            for (let i = 0; i < length; i++) {
                this.#audioData[512 + i] = Math.floor(data[i] * 255.0)
            }
        } else {
            this.#audioData.set(data.subarray(0, length), 512)
        }
    }

    /**
     * Sets MIDI CC values.
     * @param data 128 CC values, normalized 0-255 for Uint8Array or 0.0-1.0 for Float32Array
     *
     * In shader, access with: texture(iMidiCC, vec2((ccNumber + 0.5) / 128.0, 0.5)).r
     */
    setMidiCC(data: Uint8Array | Float32Array): void {
        const length = Math.min(data.length, 128)
        if (data.BYTES_PER_ELEMENT === 4) {
            for (let i = 0; i < length; i++) {
                this.#midiData[i] = Math.floor(data[i] * 255.0)
            }
        } else {
            this.#midiData.set(data.subarray(0, length), 0)
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
        gl.disable(gl.BLEND)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.#audioTexture)
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 512, 2, gl.RED, gl.UNSIGNED_BYTE, this.#audioData)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, this.#midiTexture)
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 128, 1, gl.RED, gl.UNSIGNED_BYTE, this.#midiData)
        gl.useProgram(this.#program)
        gl.uniform3f(this.#uniformLocations.iResolution, gl.drawingBufferWidth, gl.drawingBufferHeight, 1.0)
        gl.uniform1f(this.#uniformLocations.iTime, currentTime)
        gl.uniform1f(this.#uniformLocations.iTimeDelta, timeDelta)
        gl.uniform1i(this.#uniformLocations.iFrame, this.#frameCount)
        gl.uniform3fv(this.#uniformLocations.iChannelResolution, [512.0, 2.0, 1.0])
        gl.uniform1i(this.#uniformLocations.iChannel0, 0)
        gl.uniform1i(this.#uniformLocations.iMidiCC, 1)
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
        if (this.#midiTexture) {
            gl.deleteTexture(this.#midiTexture)
            this.#midiTexture = null
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

    #initMidiTexture(): void {
        const gl = this.#gl
        this.#midiTexture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, this.#midiTexture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 128, 1, 0, gl.RED, gl.UNSIGNED_BYTE, this.#midiData)
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