import {Events} from "@opendaw/lib-dom"
import {TimelineRange} from "@opendaw/studio-core"

export namespace WheelScaling {
    export const install = (element: Element, range: TimelineRange) => {
        return Events.subscribe(element, "wheel", (event: WheelEvent) => {
            event.preventDefault()
            const scale = event.deltaY * 0.01
            const rect = element.getBoundingClientRect()
            range.scaleBy(scale, range.xToValue(event.clientX - rect.left))
        }, {passive: false})
    }
}