export const wavefold = (input: number, factor: number): number => {
    const scaled = 0.25 * factor * input + 0.25
    return 4.0 * (Math.abs(scaled - Math.round(scaled)) - 0.25)
}