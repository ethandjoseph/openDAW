import {TimelineRange} from "@opendaw/studio-core"
import {AudioEventOwnerReader} from "@/ui/timeline/editors/EventOwnerReader"
import {EventCollection} from "@opendaw/lib-dsp"
import {TransientMarkerBoxAdapter, WarpMarkerBoxAdapter} from "@opendaw/studio-adapters"
import {ElementCapturing} from "@/ui/canvas/capturing"
import {isNotNull, isNull, Iterables, Nullable} from "@opendaw/lib-std"

export namespace TransientMarkerUtils {
    const MARKER_RADIUS = 4

    export const createCapturing = (element: Element,
                                    range: TimelineRange,
                                    reader: AudioEventOwnerReader,
                                    warpMarkers: EventCollection<WarpMarkerBoxAdapter>,
                                    transientMarkers: EventCollection<TransientMarkerBoxAdapter>) => new ElementCapturing<TransientMarkerBoxAdapter>(element, {
        capture: (x: number, _y: number): Nullable<TransientMarkerBoxAdapter> => {
            const unit = range.xToUnit(x) - reader.offset
            const pairWise = Iterables.pairWise(warpMarkers.iterateFrom(unit))
            for (let [left, right] of pairWise) {
                if (isNull(left)) {return null}
                if (isNull(right)) {
                    left = warpMarkers.asArray().at(-2)!
                    right = warpMarkers.asArray().at(-1)!
                    if (isNull(left) || isNull(right)) {return null}
                }
                let closest: Nullable<{ transient: TransientMarkerBoxAdapter, distance: number }> = null
                for (const transient of transientMarkers.iterateFrom(left.seconds)) {
                    const seconds = transient.position
                    if (seconds < left.seconds) {continue}
                    if (seconds > right.seconds) {break}
                    const alpha = (seconds - left.seconds) / (right.seconds - left.seconds)
                    const unit = left.position + alpha * (right.position - left.position)
                    const transientX = range.unitToX(unit + reader.offset)
                    const distance = Math.abs(transientX - x)
                    if (distance <= MARKER_RADIUS) {
                        if (isNull(closest)) {
                            closest = {transient, distance}
                        } else if (closest.distance < distance) {
                            closest.transient = transient
                            closest.distance = distance
                        }
                    }
                }
                if (isNotNull(closest)) {
                    // webstorm false positive: closest is not null here
                    // noinspection JSObjectNullOrUndefined
                    return closest.transient
                }
            }
            return null
        }
    })
}