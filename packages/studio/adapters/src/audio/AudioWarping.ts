import {ByteArrayField} from "@opendaw/lib-box"
import {Arrays, panic} from "@opendaw/lib-std"
import {WarpMarker} from "./WarpMarker"

export namespace AudioWarping {
    const VERSION = 1

    export const writeTransients = (field: ByteArrayField, positions: Float32Array): void => {
        // version byte, number of entries int32, entries
        const bytes = new Int8Array(1 + 4 + positions.length * 4)
        const view = new DataView(bytes.buffer)
        view.setUint8(0, VERSION)
        view.setUint32(1, positions.length, true)
        positions.forEach((value, index) => view.setFloat32(5 + index * 4, value, true))
        field.setValue(bytes)
    }

    export const readTransients = (field: ByteArrayField): Float32Array => {
        const view = new DataView(field.getValue().buffer)
        if (view.byteLength === 0) {
            return new Float32Array(0)
        }
        // version byte, number of entries int32, entries
        const version = view.getUint8(0)
        if (version === VERSION) {
            const numberOfEntries = view.getUint32(1, true)
            const array = new Float32Array(numberOfEntries)
            for (let i = 0; i < numberOfEntries; i++) {
                array[i] = view.getFloat32(5 + i * 4, true)
            }
            return array
        } else {
            return panic(`Unknown transients version (${version})`)
        }
    }

    export const writeWarpMarkers = (field: ByteArrayField, markers: ReadonlyArray<WarpMarker>): void => {
        // version byte, number of entries int32, entries
        const bytes = new Int8Array(1 + 4 + markers.length * 8)
        const view = new DataView(bytes.buffer)
        view.setUint8(0, VERSION)
        view.setUint32(1, markers.length, true)
        markers.forEach((marker, index) => {
            view.setInt32(5 + index * 8, marker.time, true)
            view.setFloat32(5 + index * 8 + 4, marker.seconds, true)
        })
        field.setValue(bytes)
    }

    export const readWarpMarkers = (field: ByteArrayField): ReadonlyArray<WarpMarker> => {
        const view = new DataView(field.getValue().buffer)
        if (view.byteLength === 0) {return Arrays.empty()}
        // version byte, number of entries int32, entries
        const version = view.getUint8(0)
        if (version === VERSION) {
            const numberOfEntries = view.getUint32(1, true)
            const markers: Array<WarpMarker> = []
            for (let i = 0; i < numberOfEntries; i++) {
                const time = view.getInt32(5 + i * 8, true)
                const seconds = view.getFloat32(5 + i * 8 + 4, true)
                markers[i] = {time, seconds}
            }
            return markers
        } else {
            return panic(`Unknown transients version (${version})`)
        }
    }
}