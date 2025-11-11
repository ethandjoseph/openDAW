import {OutputAudioUnit} from "../Api"
import {ProjectImpl} from "./ProjectImpl"
import {AudioUnitImpl} from "./AudioUnitImpl"

export class OutputAudioUnitImpl extends AudioUnitImpl implements OutputAudioUnit {
    readonly kind = "output" as const

    constructor(project: ProjectImpl) {
        super(project)
    }
}
