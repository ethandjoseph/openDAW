import {int, unitValue} from "@opendaw/lib-std"

const enum State { Idle, Attack, Decay, Sustain, Release }

export class ADSR {
    readonly #invSampleRate

    #state = State.Idle
    #value = 0.0
    #attack = 0.0
    #decay = 0.0
    #sustain = 0.0
    #release = 0.0
    #attackInc = 0.0
    #decayDec = 0.0
    #releaseDec = 0.0

    constructor(sampleRate: number) {this.#invSampleRate = 1.0 / sampleRate}

    get gate(): boolean { return this.#state !== State.Idle && this.#state !== State.Release }
    get complete(): boolean { return this.#state === State.Idle }
    get value(): number { return this.#value }

    set(attack: number, decay: number, sustain: unitValue, release: number): void {
        this.#attack = attack
        this.#decay = decay
        this.#sustain = sustain
        this.#release = release
        this.#updateRates()
    }

    #updateRates(): void {
        switch (this.#state) {
            case State.Attack: {
                const remain = 1.0 - this.#value
                this.#attackInc = remain * this.#invSampleRate / Math.max(this.#attack, 1e-6)
                break
            }
            case State.Decay: {
                const remain = this.#value - this.#sustain
                this.#decayDec = remain * this.#invSampleRate / Math.max(this.#decay, 1e-6)
                break
            }
            case State.Release: {
                const remain = this.#value
                this.#releaseDec = remain * this.#invSampleRate / Math.max(this.#release, 1e-6)
                break
            }
            case State.Sustain:
            case State.Idle: {
                this.#attackInc = this.#invSampleRate / Math.max(this.#attack, 1e-6)
                this.#decayDec = (1.0 - this.#sustain) * this.#invSampleRate / Math.max(this.#decay, 1e-6)
                this.#releaseDec = this.#sustain * this.#invSampleRate / Math.max(this.#release, 1e-6)
                break
            }
        }
    }

    gateOn(): void {
        this.#state = State.Attack
    }

    gateOff(): void {
        if (this.#state !== State.Idle) {
            this.#state = State.Release
            this.#updateRates()
        }
    }

    forceStop(): void {
        this.#state = State.Idle
        this.#value = 0
    }

    process(output: Float32Array, fromIndex: int, toIndex: int): void {
        for (let i = fromIndex; i < toIndex; i++) {
            switch (this.#state) {
                case State.Attack:
                    this.#value += this.#attackInc
                    if (this.#value >= 1.0) {
                        this.#value = 1.0
                        this.#state = State.Decay
                        this.#updateRates()
                    }
                    break

                case State.Decay:
                    this.#value -= this.#decayDec
                    if (this.#value <= this.#sustain) {
                        this.#value = this.#sustain
                        this.#state = State.Sustain
                        this.#updateRates()
                    }
                    break

                case State.Sustain:
                    this.#value = this.#sustain
                    break

                case State.Release:
                    this.#value -= this.#releaseDec
                    if (this.#value <= 0.0) {
                        this.#value = 0.0
                        this.#state = State.Idle
                        this.#updateRates()
                    }
                    break

                case State.Idle:
                    this.#value = 0.0
                    break
            }
            output[i] = this.#value
        }
    }
}