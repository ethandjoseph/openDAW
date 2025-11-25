import {ElementCapturing} from "@/ui/canvas/capturing"
import {WarpMarkerBoxAdapter} from "@opendaw/studio-adapters"
import {Nullable} from "@opendaw/lib-std"
import {TimelineRange} from "@opendaw/studio-core"
import {AudioEventOwnerReader} from "@/ui/timeline/editors/EventOwnerReader"
import {EventCollection} from "@opendaw/lib-dsp"

export namespace WarpMarkerCapturing {
    export const create = (element: Element,
                           range: TimelineRange,
                           reader: AudioEventOwnerReader,
                           warpMarkers: EventCollection<WarpMarkerBoxAdapter>,
                           markerRadius: number) => new ElementCapturing<WarpMarkerBoxAdapter>(element, {
        capture: (x: number, _y: number): Nullable<WarpMarkerBoxAdapter> => {
            const u0 = range.xToUnit(x - markerRadius) - reader.offset
            const u1 = range.xToUnit(x + markerRadius) - reader.offset
            let closest: Nullable<{ marker: WarpMarkerBoxAdapter, distance: number }> = null
            for (const marker of warpMarkers.iterateRange(u0, u1)) {
                const dx = x - range.unitToX(marker.position + reader.offset)
                const distance = Math.abs(dx)
                if (distance <= markerRadius) {
                    if (closest === null) {
                        closest = {marker, distance}
                    } else if (closest.distance < distance) {
                        closest.marker = marker
                        closest.distance = distance
                    }
                }
            }
            if (closest === null) {return null}
            return closest.marker
        }
    })
}