import {TimelineRange} from "@opendaw/studio-core"
import {AudioEventOwnerReader} from "@/ui/timeline/editors/EventOwnerReader"
import {EventCollection} from "@opendaw/lib-dsp"
import {TransientMarkerBoxAdapter, WarpMarkerBoxAdapter} from "@opendaw/studio-adapters"
import {ElementCapturing} from "@/ui/canvas/capturing"
import {isNull, Iterables, Nullable} from "@opendaw/lib-std"

export namespace TransientMarkerUtils {
    export const createCapturing = (element: Element,
                                    range: TimelineRange,
                                    reader: AudioEventOwnerReader,
                                    warpMarkers: EventCollection<WarpMarkerBoxAdapter>,
                                    transientMarkers: EventCollection<TransientMarkerBoxAdapter>,
                                    markerRadius: number) => new ElementCapturing<TransientMarkerBoxAdapter>(element, {
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
                for (const transient of transientMarkers.iterateFrom(left.seconds)) {
                    const seconds = transient.position
                    if (seconds > right.seconds) {return null}
                    const alpha = (seconds - left.seconds) / (right.seconds - left.seconds)
                    const unit = left.position + alpha * (right.position - left.position)
                    const transientX = range.unitToX(unit + reader.offset)
                    if (Math.abs(transientX - x) < markerRadius) {
                        return transient
                    }
                }
            }
            return null
        }
    })
}