import {BoxGraph} from "@opendaw/lib-box"
import {BoxIO} from "@opendaw/studio-boxes"
import {ProjectMandatoryBoxes} from "../index"

export type ProjectSkeleton = {
    boxGraph: BoxGraph<BoxIO.TypeMap>,
    mandatoryBoxes: ProjectMandatoryBoxes
}