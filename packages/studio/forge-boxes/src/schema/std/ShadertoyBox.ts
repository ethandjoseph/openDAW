import {BoxSchema} from "@opendaw/lib-box-forge"
import {Pointers} from "@opendaw/studio-enums"

export const ShadertoyBox: BoxSchema<Pointers> = {
    type: "box",
    class: {
        name: "ShadertoyBox",
        fields: {
            1: {type: "string", name: "shader-code"}
        }
    },
    pointerRules: {accepts: [Pointers.Shadertoy], mandatory: true}
}