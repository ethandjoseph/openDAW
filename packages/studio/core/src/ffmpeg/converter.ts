import {AcceptedSource} from "./FFmpegWorker"
import {Progress} from "@opendaw/lib-std"

export interface Converter<OPTIONS> {
    convert(source: AcceptedSource,
            progress: Progress.Handler,
            options?: OPTIONS): Promise<Blob>
}