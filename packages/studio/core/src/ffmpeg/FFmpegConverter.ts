import {AcceptedSource} from "./FFmpegWorker"
import {Progress} from "@opendaw/lib-std"

export interface FFmpegConverter<OPTIONS> {
    convert(source: AcceptedSource,
            progress: Progress.Handler,
            options?: OPTIONS): Promise<ArrayBuffer>
}