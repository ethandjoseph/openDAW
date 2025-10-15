import {int} from "@opendaw/lib-std"

export interface SoundfontMetaData {
    name: string
    size: int
    url: string
    license: string
    origin: "openDAW" | "import"
}