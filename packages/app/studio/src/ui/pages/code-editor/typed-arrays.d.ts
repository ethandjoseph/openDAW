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
