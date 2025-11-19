import {int} from "@opendaw/lib-std"

export class MIDISender {
    readonly #port: MessagePort
    readonly #indices: Uint32Array
    readonly #ring: Uint32Array
    readonly #ringMask: int

    readonly #deviceIdToNum = new Map<string, number>()
    readonly #numToDeviceId: Array<string> = []

    constructor(port: MessagePort, sab: SharedArrayBuffer) {
        this.#port = port
        this.#indices = new Uint32Array(sab, 0, 2)
        this.#ring = new Uint32Array(sab, 8)
        this.#ringMask = (this.#ring.length >> 1) - 1  // Match receiver!
    }

    send(deviceId: string, data: Uint8Array, timeMs: number): boolean {
        let deviceNum = this.#deviceIdToNum.get(deviceId)
        if (deviceNum === undefined) {
            deviceNum = this.#numToDeviceId.length
            this.#deviceIdToNum.set(deviceId, deviceNum)
            this.#numToDeviceId.push(deviceId)
            this.#port.postMessage({
                registerDevice: deviceId,
                id: deviceNum,
                firstMessage: {data: Array.from(data), timeMs}
            })
            return true
        }
        const writeIdx = Atomics.load(this.#indices, 0)
        const nextIdx = (writeIdx + 1) & this.#ringMask
        if (nextIdx === Atomics.load(this.#indices, 1)) {return false}
        const packed1 = (deviceNum << 24) | (data[0] << 16) | (data[1] << 8) | data[2]
        const packed2 = timeMs | 0
        const offset = writeIdx << 1
        this.#ring[offset] = packed1
        this.#ring[offset + 1] = packed2
        Atomics.store(this.#indices, 0, nextIdx)
        this.#port.postMessage(null)
        return true
    }
}