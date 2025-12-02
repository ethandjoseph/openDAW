import {TimelineRange} from "@opendaw/studio-core"
import {AudioEventOwnerReader} from "@/ui/timeline/editors/EventOwnerReader"
import {EventCollection} from "@opendaw/lib-dsp"
import {TransientMarkerBoxAdapter, WarpMarkerBoxAdapter} from "@opendaw/studio-adapters"
import {ElementCapturing} from "@/ui/canvas/capturing"
import {isNotNull, Nullable} from "@opendaw/lib-std"

export namespace TransientMarkerUtils {
    const MARKER_RADIUS = 4

    export const createCapturing = (element: Element,
                                    range: TimelineRange,
                                    reader: AudioEventOwnerReader,
                                    warpMarkers: EventCollection<WarpMarkerBoxAdapter>,
                                    transientMarkers: EventCollection<TransientMarkerBoxAdapter>) => new ElementCapturing<TransientMarkerBoxAdapter>(element, {
        capture: (x: number, _y: number): Nullable<TransientMarkerBoxAdapter> => {
            const waveformOffset = reader.waveformOffset.getValue()
            const markers = warpMarkers.asArray()
            if (markers.length < 2) {return null}
            const first = markers[0]
            const second = markers[1]
            const secondLast = markers[markers.length - 2]
            const last = markers[markers.length - 1]
            const firstRate = (second.position - first.position) / (second.seconds - first.seconds)
            const lastRate = (last.position - secondLast.position) / (last.seconds - secondLast.seconds)
            const secondsToLocalUnit = (seconds: number): number => {
                if (seconds < first.seconds) {
                    return first.position + (seconds - first.seconds) * firstRate
                }
                if (seconds > last.seconds) {
                    return last.position + (seconds - last.seconds) * lastRate
                }
                for (let i = 0; i < markers.length - 1; i++) {
                    const left = markers[i]
                    const right = markers[i + 1]
                    if (seconds >= left.seconds && seconds <= right.seconds) {
                        const t = (seconds - left.seconds) / (right.seconds - left.seconds)
                        return left.position + t * (right.position - left.position)
                    }
                }
                return last.position
            }
            let closest: Nullable<{ transient: TransientMarkerBoxAdapter, distance: number }> = null
            for (const transient of transientMarkers.asArray()) {
                const adjustedSeconds = transient.position - waveformOffset
                const localUnit = secondsToLocalUnit(adjustedSeconds)
                const unit = reader.offset + localUnit
                const transientX = range.unitToX(unit)
                const distance = Math.abs(transientX - x)
                if (distance <= MARKER_RADIUS) {
                    if (closest === null || distance < closest.distance) {
                        closest = {transient, distance}
                    }
                }
            }
            return isNotNull(closest) ? closest.transient : null
        }
    })
}