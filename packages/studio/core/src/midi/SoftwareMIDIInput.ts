import {
    byte,
    clamp,
    DefaultObservableValue,
    int,
    isNull,
    Nullable,
    ObservableValue,
    safeExecute,
    unitValue
} from "@opendaw/lib-std"
import {MidiData} from "@opendaw/lib-midi"

type OnMidiMessage = Nullable<(this: MIDIInput, ev: MIDIMessageEvent) => any>

export class SoftwareMIDIInput implements MIDIInput {
    readonly manufacturer: string | null = "openDAW"
    readonly connection: MIDIPortConnectionState = "open"
    readonly id: string = "software-midi-input"
    readonly name: string | null = "Software Keyboard"
    readonly state: MIDIPortDeviceState = "connected"
    readonly type: MIDIPortType = "input"
    readonly version: string | null = "1.0.0"

    readonly #dispatcher: EventTarget
    readonly #countListeners: DefaultObservableValue<int>

    #onmidimessage: OnMidiMessage = null
    onstatechange: ((this: MIDIPort, ev: MIDIConnectionEvent) => any) | null = null // has no effect. always on.
    channel: byte = 0 // 0...15

    constructor() {
        this.#dispatcher = new EventTarget()
        this.#countListeners = new DefaultObservableValue(0)
    }

    get onmidimessage(): OnMidiMessage {return this.#onmidimessage}
    set onmidimessage(value: OnMidiMessage) {
        this.#onmidimessage = value
        if (isNull(value)) {this.#changeListenerCount(-1)} else {this.#changeListenerCount(1)}
    }

    get countListeners(): ObservableValue<int> {return this.#countListeners}

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
        console.debug("add")
        this.#dispatcher.addEventListener(type, listener, options)
        this.#changeListenerCount(1)
    }
    dispatchEvent(event: MIDIMessageEvent): boolean {
        safeExecute(this.#onmidimessage, event)
        return this.#dispatcher.dispatchEvent(event)
    }
    removeEventListener<K extends keyof MIDIInputEventMap>(type: K, listener: (this: MIDIInput, ev: MIDIInputEventMap[K]) => any, options?: boolean | EventListenerOptions): void
    removeEventListener<K extends keyof MIDIPortEventMap>(type: K, listener: (this: MIDIPort, ev: MIDIPortEventMap[K]) => any, options?: boolean | EventListenerOptions): void
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
        console.debug("remove")
        this.#dispatcher.removeEventListener(type, listener, options)
        this.#changeListenerCount(-1)
    }

    #changeListenerCount(delta: -1 | 1): void {
        console.debug("changeListenerCount", delta)
        this.#countListeners.setValue(this.#countListeners.getValue() + delta)
    }
}