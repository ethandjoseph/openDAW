import {Dragging} from "@opendaw/lib-dom"
import {BoxEditing} from "@opendaw/lib-box"

export interface Modifier {
    update(event: Dragging.Event): void
    approve(editing: BoxEditing): void
    cancel(): void
}