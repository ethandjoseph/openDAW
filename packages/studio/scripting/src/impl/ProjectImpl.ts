import {GroupAudioUnit, InstrumentAudioUnit, Instruments, OutputAudioUnit, Project, ReturnAudioUnit} from "../Api"
import {OutputAudioUnitImpl} from "./OutputAudioUnitImpl"
import {InstrumentAudioUnitImpl} from "./InstrumentAudioUnitImpl"
import {ReturnAudioUnitImpl} from "./ReturnAudioUnitImpl"
import {GroupAudioUnitImpl} from "./GroupAudioUnitImpl"
import {ApiImpl} from "./ApiImpl"
import {Converter} from "../Converter"

export class ProjectImpl implements Project {
    readonly api: ApiImpl
    readonly output: OutputAudioUnit

    name: string
    tempo: number

    #instruments: InstrumentAudioUnitImpl[] = []
    #returns: ReturnAudioUnitImpl[] = []
    #groups: GroupAudioUnitImpl[] = []

    constructor(api: ApiImpl, name: string) {
        this.api = api
        this.name = name
        this.tempo = 120
        this.output = new OutputAudioUnitImpl(this)
    }

    openInStudio(): void {this.api.environment.openProject(Converter.toSkeleton(this), this.name)}

    addInstrumentUnit<KEY extends keyof Instruments>(
        name: KEY,
        props?: Partial<Instruments[KEY]>
    ): InstrumentAudioUnit {
        const unit = new InstrumentAudioUnitImpl(this, name, props)
        this.#instruments.push(unit)
        return unit
    }

    addReturnUnit(): ReturnAudioUnit {
        const unit = new ReturnAudioUnitImpl(this)
        this.#returns.push(unit)
        return unit
    }

    addGroupUnit(): GroupAudioUnit {
        const unit = new GroupAudioUnitImpl(this)
        this.#groups.push(unit)
        return unit
    }

    getInstrumentUnits(): ReadonlyArray<InstrumentAudioUnitImpl> {
        return this.#instruments
    }

    getReturnUnits(): ReadonlyArray<ReturnAudioUnitImpl> {
        return this.#returns
    }

    getGroupUnits(): ReadonlyArray<GroupAudioUnitImpl> {
        return this.#groups
    }
}
