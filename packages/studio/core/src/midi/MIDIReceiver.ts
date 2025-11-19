import {int, Terminable} from "@opendaw/lib-std"

type MIDIMessageCallback = (deviceId: string, data: Uint8Array, timeMs: int) => void

export class MIDIReceiver implements Terminable {
    readonly #port: MessagePort
    readonly #indices: Uint32Array
    readonly #ring: Uint32Array
    readonly #messageMask: int
    readonly #onMessage: MIDIMessageCallback
    readonly #deviceIds = new Map<int, string>()

    constructor(sab: SharedArrayBuffer, port: MessagePort, onMessage: MIDIMessageCallback) {
        this.#indices = new Uint32Array(sab, 0, 2)
        this.#ring = new Uint32Array(sab, 8)
        this.#messageMask = (this.#ring.length >> 1) - 1
        this.#port = port
        this.#onMessage = onMessage
        this.#port.onmessage = (event) => {
            if (event.data?.registerDevice) {
                this.#deviceIds.set(event.data.id, event.data.registerDevice)
                if (event.data.firstMessage) {
                    this.#onMessage(
                        event.data.registerDevice,
                        new Uint8Array(event.data.firstMessage.data),
                        event.data.firstMessage.timeMs
                    )
                }
            } else {
                this.#read()
            }
        }
    }

    terminate(): void {this.#port.close()}

    #read(): void {
        let readIdx = Atomics.load(this.#indices, 1)
        const writeIdx = Atomics.load(this.#indices, 0)
        while (readIdx !== writeIdx) {
            const offset = readIdx << 1
            const packed1 = this.#ring[offset]
            const packed2 = this.#ring[offset + 1]
            const deviceIdNum = packed1 >>> 24
            const status = (packed1 >>> 16) & 0xFF
            const data1 = (packed1 >>> 8) & 0xFF
            const data2 = packed1 & 0xFF
            const timeMs = packed2
            const deviceId = this.#deviceIds.get(deviceIdNum) ?? "unknown"
            // Determine message length from status byte
            let data: Uint8Array
            if (status >= 0xF8) {
                // System Real-Time: 1 byte
                data = new Uint8Array([status])
            } else if (status >= 0xF0 || (status & 0xF0) === 0xC0 || (status & 0xF0) === 0xD0) {
                // System Common, Program Change, Channel Pressure: 2 bytes
                data = new Uint8Array([status, data1])
            } else {
                // Note on/off, CC aso.: 3 bytes
                data = new Uint8Array([status, data1, data2])
            }
            this.#onMessage(deviceId, data, timeMs)
            readIdx = (readIdx + 1) & this.#messageMask
        }
        Atomics.store(this.#indices, 1, readIdx)
    }
}