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
                                    _markerRadius: number) => new ElementCapturing<TransientMarkerBoxAdapter>(element, {
        capture: (x: number, _y: number): Nullable<TransientMarkerBoxAdapter> => {
            const unit = range.xToUnit(x) - reader.offset
            const pairWise = Iterables.pairWise(warpMarkers.iterateFrom(unit - reader.offset))
            for (const [left, right] of pairWise) {
                if (isNull(left) || isNull(right)) {break}
                for (const transient of transientMarkers.iterateFrom(left.seconds)) {
                    const seconds = transient.position
                    if (seconds >= left.seconds && seconds <= right.seconds) {
                        return transient
                    }
                }
            }

            return null
        }
    })
}