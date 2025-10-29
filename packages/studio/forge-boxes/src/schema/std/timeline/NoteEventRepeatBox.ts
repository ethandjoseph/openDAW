// TODO Create, refer this and remove 'play-count' and 'play-curve' from NoteEventBox
import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"

export const NoteEventRepeatBox: BoxSchema<Pointers> = {
    type: "box",
    class: {
        name: "NoteEventRepeatBox",
        fields: {
            1: {type: "pointer", name: "event", pointerType: Pointers.NoteEventFeature, mandatory: true},
            2: {type: "int32", name: "count", value: 1}, // [1...128]
            3: {type: "float32", name: "curve", value: 0.0}, // [-1...1]
            4: {type: "float32", name: "length", value: 1.0} // [0...1]
        }
    }
}