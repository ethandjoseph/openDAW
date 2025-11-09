declare class TypedArray {
    readonly buffer: ArrayBuffer
    readonly byteOffset: number
    readonly byteLength: number
    readonly length: number
    [index: number]: number | bigint
    copyWithin(target: number, start: number, end?: number): this
    every(callbackfn: (value: any, index: number, array: this) => boolean): boolean
    fill(value: any, start?: number, end?: number): this
    filter(callbackfn: (value: any, index: number, array: this) => boolean): this
    find(callbackfn: (value: any, index: number, array: this) => boolean): any
    findIndex(callbackfn: (value: any, index: number, array: this) => boolean): number
    forEach(callbackfn: (value: any, index: number, array: this) => void): void
    includes(value: any, fromIndex?: number): boolean
    indexOf(value: any, fromIndex?: number): number
    join(separator?: string): string
    lastIndexOf(value: any, fromIndex?: number): number
    map(callbackfn: (value: any, index: number, array: this) => any): this
    reduce(callbackfn: (prev: any, curr: any, index: number, array: this) => any): any
    reduceRight(callbackfn: (prev: any, curr: any, index: number, array: this) => any): any
    reverse(): this
    set(array: ArrayLike<any>, offset?: number): void
    slice(start?: number, end?: number): this
    some(callbackfn: (value: any, index: number, array: this) => boolean): boolean
    sort(compareFn?: (a: any, b: any) => number): this
    subarray(begin?: number, end?: number): this
    toLocaleString(): string
    toString(): string
    values(): IterableIterator<any>
    keys(): IterableIterator<number>
    entries(): IterableIterator<[number, any]>
    [Symbol.iterator](): IterableIterator<any>
}

declare class Int8Array extends TypedArray {
    [index: number]: number
    constructor(length: number)
    constructor(array: ArrayLike<number> | ArrayBuffer)
}

declare class Uint8Array extends TypedArray {
    [index: number]: number;
    constructor(length: number);
    constructor(array: ArrayLike<number> | ArrayBuffer)
}

declare class Uint8ClampedArray extends TypedArray {
    [index: number]: number;
    constructor(length: number);
    constructor(array: ArrayLike<number> | ArrayBuffer)
}

declare class Int16Array extends TypedArray {
    [index: number]: number;
    constructor(length: number);
    constructor(array: ArrayLike<number> | ArrayBuffer)
}

declare class Uint16Array extends TypedArray {
    [index: number]: number;
    constructor(length: number);
    constructor(array: ArrayLike<number> | ArrayBuffer)
}

declare class Int32Array extends TypedArray {
    [index: number]: number;
    constructor(length: number);
    constructor(array: ArrayLike<number> | ArrayBuffer)
}

declare class Uint32Array extends TypedArray {
    [index: number]: number;
    constructor(length: number);
    constructor(array: ArrayLike<number> | ArrayBuffer)
}

declare class Float32Array extends TypedArray {
    [index: number]: number;
    constructor(length: number);
    constructor(array: ArrayLike<number> | ArrayBuffer)
}

declare class Float64Array extends TypedArray {
    [index: number]: number;
    constructor(length: number);
    constructor(array: ArrayLike<number> | ArrayBuffer)
}

declare class BigInt64Array extends TypedArray {
    [index: number]: bigint;
    constructor(length: number);
    constructor(array: ArrayLike<bigint> | ArrayBuffer)
}

declare class BigUint64Array extends TypedArray {
    [index: number]: bigint;
    constructor(length: number);
    constructor(array: ArrayLike<bigint> | ArrayBuffer)
}

declare class Array<T> {
    readonly length: number
    [index: number]: T

    constructor()
    constructor(length: number)
    constructor(...items: T[])

    at(index: number): T | undefined
    concat(...items: (T | ConcatArray<T>)[]): T[]
    copyWithin(target: number, start: number, end?: number): this
    entries(): IterableIterator<[number, T]>
    every(callbackfn: (value: T, index: number, array: T[]) => boolean): boolean
    fill(value: T, start?: number, end?: number): this
    filter(callbackfn: (value: T, index: number, array: T[]) => boolean): T[]
    find(callbackfn: (value: T, index: number, array: T[]) => boolean): T | undefined
    findIndex(callbackfn: (value: T, index: number, array: T[]) => boolean): number
    flat<U>(this: U[][], depth?: number): U[]
    flatMap<U>(callbackfn: (value: T, index: number, array: T[]) => U | readonly U[]): U[]
    forEach(callbackfn: (value: T, index: number, array: T[]) => void): void
    includes(value: T, fromIndex?: number): boolean
    indexOf(value: T, fromIndex?: number): number
    join(separator?: string): string
    keys(): IterableIterator<number>
    lastIndexOf(value: T, fromIndex?: number): number
    map<U>(callbackfn: (value: T, index: number, array: T[]) => U): U[]
    pop(): T | undefined
    push(...items: T[]): number
    reduce(callbackfn: (prev: T, curr: T, index: number, array: T[]) => T): T
    reduceRight(callbackfn: (prev: T, curr: T, index: number, array: T[]) => T): T
    reverse(): this
    shift(): T | undefined
    slice(start?: number, end?: number): T[]
    some(callbackfn: (value: T, index: number, array: T[]) => boolean): boolean
    sort(compareFn?: (a: T, b: T) => number): this
    splice(start: number, deleteCount?: number, ...items: T[]): T[]
    toLocaleString(): string
    toString(): string
    unshift(...items: T[]): number
    values(): IterableIterator<T>
    [Symbol.iterator](): IterableIterator<T>
    [Symbol.unscopables](): Record<string, boolean>
}

interface ConcatArray<T> {
    readonly length: number
    [n: number]: T
    concat(...items: ConcatArray<T>[]): T[]
}