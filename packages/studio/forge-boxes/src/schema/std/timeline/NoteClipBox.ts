import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"
import {ClipPlaybackFields} from "./ClipPlaybackFields"

export const NoteClipBox: BoxSchema<Pointers> = {
    type: "box",
    class: {
        name: "NoteClipBox",
        fields: {
            1: {type: "pointer", name: "clips", pointerType: Pointers.ClipCollection, mandatory: true},
            2: {type: "pointer", name: "events", pointerType: Pointers.NoteEventCollection, mandatory: true},
            3: {type: "int32", name: "index"},
            4: {type: "object", name: "playback", class: ClipPlaybackFields},
            10: {type: "int32", name: "duration"},
            11: {type: "boolean", name: "mute"},
            12: {type: "string", name: "label"},
            13: {type: "int32", name: "hue"}
        }
    }, pointerRules: {accepts: [Pointers.Selection, Pointers.Editing], mandatory: false}
}