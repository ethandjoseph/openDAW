import {Id, int, isDefined, Nullable} from "@opendaw/lib-std"
import {AudioBuffer, NoteEvent} from "@opendaw/lib-dsp"
import {Voice} from "./Voice"
import {VoiceHost} from "./VoiceHost"
import {VoicingStrategy} from "./VoicingStrategy"
import {Block} from "../processing"

export class MonophonicStrategy implements VoicingStrategy {
    readonly #host: VoiceHost
    readonly #processing: Array<Voice> = []
    readonly #stack: Array<Id<NoteEvent>> = []

    #triggered: Nullable<Voice> = null // voice with the gate on
    #sounding: Nullable<Voice> = null // voice currently producing sound

    constructor(host: VoiceHost) {this.#host = host}

    start(event: Id<NoteEvent>): void {
        this.#stack.push(event)

        if (isDefined(this.#triggered)) {
            if (this.#triggered.gate) {
                this.#triggered.startGlide(this.#host.computeFrequency(event), this.#host.glideTime())
                return
            }
        }

        if (isDefined(this.#sounding)) {
            this.#sounding.forceStop()
        }

        const voice = this.#host.create()
        voice.start(event.id, this.#host.computeFrequency(event), event.velocity)
        this.#triggered = voice
        this.#sounding = voice
        this.#processing.push(voice)
    }

    stop(id: int): void {
        const index = this.#stack.findIndex(event => event.id === id)
        if (index === -1) {return}

        this.#stack.splice(index, 1)

        if (!isDefined(this.#triggered)) return

        // released the topmost key and glide back if another note held
        if (index === this.#stack.length) {
            const prev = this.#stack.at(-1)
            if (isDefined(prev)) {
                this.#triggered.startGlide(this.#host.computeFrequency(prev), this.#host.glideTime())
                return
            }
        }
        if (this.#stack.length === 0) {
            this.#triggered.stop()
            this.#triggered = null
        }
    }

    reset(): void {
        this.#stack.length = 0
        this.#processing.length = 0
        this.#triggered = null
        this.#sounding = null
    }

    process(output: AudioBuffer, block: Block, fromIndex: int, toIndex: int): void {
        output.clear(fromIndex, toIndex)
        for (let i = this.#processing.length - 1; i >= 0; i--) {
            const voice = this.#processing[i]
            if (voice.process(output, block, fromIndex, toIndex)) {
                this.#processing.splice(i, 1)
                if (voice === this.#triggered) {this.#triggered = null}
                if (voice === this.#sounding) {this.#sounding = null}
            }
        }
    }
}