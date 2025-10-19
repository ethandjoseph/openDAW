import {z} from "zod"
import {isDefined, tryCatch} from "@opendaw/lib-std"

const PreferencesSchema = z.object({
    "auto-open-clips": z.boolean().default(false),
    "auto-create-output-compressor": z.boolean().default(true)
})

export type Preferences = z.infer<typeof PreferencesSchema>

export namespace Preferences {
    const STORAGE_KEY = "preferences"

    const watch = (target: Preferences): Preferences => new Proxy(target, {
        set(obj, prop, value) {
            (obj as any)[prop] = value
            tryCatch(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(target)))
            return true
        }
    })

    const getOrCreate = (): Preferences => {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (isDefined(stored)) {
            const {status, value} = tryCatch(() => JSON.parse(stored))
            if (status === "success") {
                return watch(PreferencesSchema.parse(value))
            }
        }
        return watch(PreferencesSchema.parse({}))
    }

    export const Default: Preferences = getOrCreate()
}