import {EventCollection, ppqn} from "@opendaw/lib-dsp"
import {Nullable} from "@opendaw/lib-std"
import {WarpMarkerBoxAdapter} from "@opendaw/studio-adapters"

export namespace WarpMarkerUtils {
    export const findAdjacent = (position: ppqn,
                                           warpMarkers: EventCollection<WarpMarkerBoxAdapter>)
        : [Nullable<WarpMarkerBoxAdapter>, Nullable<WarpMarkerBoxAdapter>] => {
        const left = warpMarkers.lowerEqual(position - 1)
        const right = warpMarkers.greaterEqual(position + 1)
        return [left, right]
    }
}