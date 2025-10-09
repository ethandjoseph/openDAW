import {int} from "@opendaw/lib-std"

enum ADSRState {
    Attack,
    Decay,
    Sustain,
    Release,
    Complete
}

export class ADSREnvelope {
    readonly attackSamples: number
    readonly decaySamples: number
    readonly sustainLevel: number
    readonly releaseSamples: number

    #state: ADSRState = ADSRState.Attack
    #position: int = 0 | 0
    #value: number = 0.0
    #releaseStartValue: number = 0.0

    constructor(attackTime: number, decayTime: number, sustainLevel: number, releaseTime: number) {
        this.attackSamples = attackTime * sampleRate
        this.decaySamples = decayTime * sampleRate
        this.sustainLevel = Math.max(0.0, Math.min(1.0, sustainLevel))
        this.releaseSamples = releaseTime * sampleRate
    }

    get isComplete(): boolean {
        return this.#state === ADSRState.Complete
    }

    release(): void {
        if (this.#state !== ADSRState.Complete && this.#state !== ADSRState.Release) {
            this.#releaseStartValue = this.#value
            this.#state = ADSRState.Release
            this.#position = 0
        }
    }

    process(): number {
        switch (this.#state) {
            case ADSRState.Attack:
                if (this.attackSamples <= 0) {
                    this.#value = 1.0
                    this.#state = ADSRState.Decay
                    this.#position = 0
                } else {
                    this.#value = this.#position++ / this.attackSamples
                    if (this.#value >= 1.0) {
                        this.#value = 1.0
                        this.#state = ADSRState.Decay
                        this.#position = 0
                    }
                }
                break

            case ADSRState.Decay:
                if (this.decaySamples <= 0) {
                    this.#value = this.sustainLevel
                    this.#state = ADSRState.Sustain
                    this.#position = 0
                } else {
                    this.#value = 1.0 - (this.#position++ / this.decaySamples) * (1.0 - this.sustainLevel)
                    if (this.#value <= this.sustainLevel) {
                        this.#value = this.sustainLevel
                        this.#state = ADSRState.Sustain
                        this.#position = 0
                    }
                }
                break

            case ADSRState.Sustain:
                this.#value = this.sustainLevel
                break

            case ADSRState.Release:
                if (this.releaseSamples <= 0) {
                    this.#value = 0.0
                    this.#state = ADSRState.Complete
                } else {
                    this.#value = this.#releaseStartValue * (1.0 - this.#position++ / this.releaseSamples)
                    if (this.#value <= 0.001 || this.#position >= this.releaseSamples) {
                        this.#value = 0.0
                        this.#state = ADSRState.Complete
                    }
                }
                break

            case ADSRState.Complete:
                this.#value = 0.0
                break
        }

        return this.#value
    }
}