import {unitValue} from "@opendaw/lib-std"

export class TidalComputer {
    static readonly #SLOPE_MULT: number = 10.0

    #depth: number = 1.0
    #slope: number = 0.0
    #symmetry: number = 0.0

    #pEx: number = 0.0
    #invS0: number = 0.0
    #invS1: number = 0.0

    set(depth: number, slope: number, symmetry: number): void {
        this.#depth = depth
        this.#slope = slope * TidalComputer.#SLOPE_MULT
        this.#symmetry = symmetry

        this.#pEx = 2.0 ** Math.abs(this.#slope)
        this.#invS0 = 1.0 / this.#symmetry
        this.#invS1 = 1.0 / (1.0 - symmetry)
    }

    compute(input: unitValue): unitValue {
        const p = input - Math.floor(input)
        const x = this.#slope < 0.0 ? 1.0 - p : p
        if (x <= this.#symmetry) {
            return 1.0 - ((1.0 - x * this.#invS0) ** this.#pEx) * this.#depth
        } else {
            return (((1.0 - x) * this.#invS1) ** this.#pEx) * this.#depth - this.#depth + 1.0
        }
    }
}