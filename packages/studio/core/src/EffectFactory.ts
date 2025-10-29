import {EffectPointerType, IconSymbol} from "@opendaw/studio-adapters"
import {Field} from "@opendaw/lib-box"
import {int} from "@opendaw/lib-std"
import {Project} from "./project"
import {EffectBox} from "./EffectBox"

export interface EffectFactory {
    readonly defaultName: string
    readonly defaultIcon: IconSymbol
    readonly description: string
    readonly manualPage?: string
    readonly separatorBefore: boolean
    readonly type: "audio" | "midi"

    create(project: Project, unit: Field<EffectPointerType>, index: int): EffectBox
}