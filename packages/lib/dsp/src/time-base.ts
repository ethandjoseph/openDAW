import {ValueOwner} from "@opendaw/lib-std"
import {ppqn, samples, seconds} from "./ppqn"
import {TempoMap} from "./tempo"

export enum TimeBase {
    Musical = "musical", // PPQN
    Seconds = "seconds",
}

/**
 * Converts between musical time (PPQN) and absolute time (seconds/samples) for a specific value.
 * The converter knows the value's native time-base and uses a TempoMap for conversions.
 */
export class TimeBaseConverter {
    readonly #property: ValueOwner<number>
    readonly #timeBase: ValueOwner<TimeBase>
    readonly #position: ValueOwner<ppqn>
    readonly #tempoMap: TempoMap

    constructor(property: ValueOwner<number>,
                timeBase: ValueOwner<TimeBase>,
                position: ValueOwner<ppqn>,
                tempoMap: TempoMap
    ) {
        this.#property = property
        this.#timeBase = timeBase
        this.#position = position
        this.#tempoMap = tempoMap
    }

    toPPQN(): ppqn {
        const value = this.#property.getValue()
        const timeBase = this.#timeBase.getValue()
        if (timeBase === TimeBase.Musical) {return value}
        const position = this.#position.getValue()
        const startSeconds = this.#tempoMap.positionToSeconds(position)
        const endSeconds = startSeconds + value
        return this.#tempoMap.intervalToPPQN(startSeconds, endSeconds)
    }

    toSeconds(): seconds {
        const value = this.#property.getValue()
        const timeBase = this.#timeBase.getValue()
        if (timeBase === TimeBase.Seconds) {return value}
        const position = this.#position.getValue()
        return this.#tempoMap.intervalToSeconds(position, position + value)
    }

    toSamples(sampleRate: number): samples {return this.toSeconds() * sampleRate}

    rawValue(): number {return this.#property.getValue()}
    getTimeBase(): TimeBase {return this.#timeBase.getValue()}
}