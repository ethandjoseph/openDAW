import css from "./ControlValue.sass?inline"
import {Html} from "@opendaw/lib-dom"
import {byte, Lifecycle} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {AutomatableParameterFieldAdapter, IconSymbol, MIDIOutputDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {ParameterLabel} from "@/ui/components/ParameterLabel"
import {RelativeUnitValueDragging} from "@/ui/wrapper/RelativeUnitValueDragging"
import {Project} from "@opendaw/studio-core"
import {Button} from "@/ui/components/Button"
import {Icon} from "@/ui/components/Icon"

const className = Html.adoptStyleSheet(css, "ControlValue")

type Construct = {
    lifecycle: Lifecycle
    project: Project
    adapter: MIDIOutputDeviceBoxAdapter
    parameter: AutomatableParameterFieldAdapter<byte>
}

export const ControlValue = ({lifecycle, project, adapter, parameter}: Construct) => {
    const {editing, midiLearning} = project
    return (
        <div className={className}>
            <span>{parameter.name}</span>
            <RelativeUnitValueDragging lifecycle={lifecycle}
                                       editing={editing}
                                       parameter={parameter}>
                <ParameterLabel lifecycle={lifecycle}
                                editing={editing}
                                midiLearning={midiLearning}
                                adapter={adapter}
                                parameter={parameter}
                                framed standalone/>
            </RelativeUnitValueDragging>
            <Button lifecycle={lifecycle} onClick={() => editing.modify(() => parameter.field.box.delete())}>
                <Icon symbol={IconSymbol.Delete}/>
            </Button>
        </div>
    )
}