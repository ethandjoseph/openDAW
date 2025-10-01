import {byte, clamp, safeExecute, Terminable, unitValue} from "@opendaw/lib-std"
import {MidiData} from "@opendaw/lib-midi"

export class SoftwareMIDIInput implements MIDIInput, Terminable {
    readonly manufacturer: string | null = "openDAW"
    readonly connection: MIDIPortConnectionState = "open"
    readonly id: string = "software-midi-input"
    readonly name: string | null = "Software Keyboard"
    readonly state: MIDIPortDeviceState = "connected"
    readonly type: MIDIPortType = "input"
    readonly version: string | null = "1.0.0"

    readonly #dispatcher: EventTarget

    onmidimessage: ((this: MIDIInput, ev: MIDIMessageEvent) => any) | null = null
    onstatechange: ((this: MIDIPort, ev: MIDIConnectionEvent) => any) | null = null // has no effect. always on.
    channel: byte = 0 // 0...16

    constructor() {this.#dispatcher = new EventTarget()}

    sendNoteOnEvent(note: byte, velocity: unitValue = 1.0): void {
        const velocityByte = Math.round(clamp(velocity, 0, 1) * 127)
        this.sendMIDIMessageData(MidiData.noteOn(this.channel, note, velocityByte))
    }

    sendNoteOffEvent(note: byte): void {
        this.sendMIDIMessageData(MidiData.noteOff(this.channel, note))
    }

    sendMIDIMessageData(data: Uint8Array): void {
        const eventInit: MessageEventInit = {data}
        this.dispatchEvent(new MessageEvent("midimessage", eventInit))
    }

    open(): Promise<MIDIPort> {return Promise.resolve(this)}
    close(): Promise<MIDIPort> {return Promise.resolve(this)}
    addEventListener<K extends keyof MIDIInputEventMap>(type: K, listener: (this: MIDIInput, ev: MIDIInputEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void
    addEventListener<K extends keyof MIDIPortEventMap>(type: K, listener: (this: MIDIPort, ev: MIDIPortEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
        this.#dispatcher.addEventListener(type, listener, options)
    }
    dispatchEvent(event: MIDIMessageEvent): boolean {
        safeExecute(this.onmidimessage, event)
        return this.#dispatcher.dispatchEvent(event)
    }
    removeEventListener<K extends keyof MIDIInputEventMap>(type: K, listener: (this: MIDIInput, ev: MIDIInputEventMap[K]) => any, options?: boolean | EventListenerOptions): void
    removeEventListener<K extends keyof MIDIPortEventMap>(type: K, listener: (this: MIDIPort, ev: MIDIPortEventMap[K]) => any, options?: boolean | EventListenerOptions): void
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
        this.#dispatcher.removeEventListener(type, listener, options)
    }

    terminate(): void {
        this.#dispatcher.dispatchEvent(new Event("close"))
    }
}