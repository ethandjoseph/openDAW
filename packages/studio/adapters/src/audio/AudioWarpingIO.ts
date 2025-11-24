import {ByteArrayField} from "@opendaw/lib-box"
import {Arrays, panic} from "@opendaw/lib-std"
import {WarpMarker} from "./WarpMarker"
import {TransientMarker} from "./TransientMarker"

export namespace AudioWarpingIO {
    const VERSION = 1

    // version: byte, number of entries: int32, entries: stream

    export const writeTransientMarkers = (field: ByteArrayField, positions: ReadonlyArray<TransientMarker>): void => {
        const bytes = new Int8Array(1 + 4 + positions.length * 8)
        const view = new DataView(bytes.buffer)
        view.setUint8(0, VERSION)
        view.setUint32(1, positions.length, true)
        positions.forEach((value, index) => {
            view.setFloat32(5 + index * 8, value.seconds, true)
            view.setFloat32(5 + index * 8 + 4, value.energy, true)
        })
        field.setValue(bytes)
    }

    export const readTransientMarkers = (field: ByteArrayField): ReadonlyArray<TransientMarker> => {
        const view = new DataView(field.getValue().buffer)
        if (view.byteLength === 0) {
            return Arrays.empty()
        }
        const version = view.getUint8(0)
        if (version === VERSION) {
            const numberOfEntries = view.getUint32(1, true)
            const array: Array<TransientMarker> = []
            for (let i = 0; i < numberOfEntries; i++) {
                const seconds = view.getFloat32(5 + i * 8, true)
                const energy = view.getFloat32(5 + i * 8 + 4, true)
                array[i] = {seconds, energy}
            }
            return array
        } else {
            return panic(`Unknown transients version (${version})`)
        }
    }

    export const writeWarpMarkers = (field: ByteArrayField, markers: ReadonlyArray<WarpMarker>): void => {
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
            return panic(`Unknown warp version (${version})`)
        }
    }
}