import {BoxGraph} from "@opendaw/lib-box"
import {ByteArrayOutput} from "@opendaw/lib-std"
import {ProjectSkeletonHeader} from "./ProjectSkeletonHeader"

export namespace ProjectSkeletonEncoder {
    export const encode = (boxGraph: BoxGraph) => {
        const output = ByteArrayOutput.create()
        output.writeInt(ProjectSkeletonHeader.MAGIC_HEADER_OPEN)
        output.writeInt(ProjectSkeletonHeader.FORMAT_VERSION)
        const boxGraphChunk = boxGraph.toArrayBuffer()
        output.writeInt(boxGraphChunk.byteLength)
        output.writeBytes(new Int8Array(boxGraphChunk))
        return output.toArrayBuffer()
    }
}