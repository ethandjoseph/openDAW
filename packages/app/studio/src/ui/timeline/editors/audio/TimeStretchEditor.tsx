import css from "./TimeStretchEditor.sass?inline"
import {Html} from "@opendaw/lib-dom"
import {DefaultObservableValue, Lifecycle, Nullable, StringMapping} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {IconSymbol, TransientPlayMode} from "@opendaw/studio-enums"
import {Project} from "@opendaw/studio-core"
import {AudioEventOwnerReader} from "@/ui/timeline/editors/EventOwnerReader"
import {RadioGroup} from "@/ui/components/RadioGroup"
import {Icon} from "@/ui/components/Icon"
import {NumberInput} from "@/ui/components/NumberInput"

const className = Html.adoptStyleSheet(css, "TimeStretchEditor")

type Construct = {
    lifecycle: Lifecycle
    project: Project
    reader: AudioEventOwnerReader
}

export const TimeStretchEditor = ({lifecycle, project, reader}: Construct) => {
    const {} = project
    const {audioContent} = reader
    const toTransientPlayMode = (): Nullable<TransientPlayMode> => audioContent.asPlayModeTimeStretch
        .mapOr(adapter => adapter.transientPlayMode, null)
    const transientPlayModeEnumValue = new DefaultObservableValue<Nullable<TransientPlayMode>>(toTransientPlayMode())
    lifecycle.ownAll(
        audioContent.box.playMode.catchupAndSubscribe(() => transientPlayModeEnumValue.setValue(toTransientPlayMode()))
    )
    return (
        <div className={className}>
            <RadioGroup lifecycle={lifecycle}
                        model={transientPlayModeEnumValue}
                        elements={[
                            {
                                value: TransientPlayMode.Once,
                                element: (<Icon symbol={IconSymbol.PlayOnce}/>),
                                tooltip: "Play transient once"
                            },
                            {
                                value: TransientPlayMode.Repeat,
                                element: (<Icon symbol={IconSymbol.PlayRepeat}/>),
                                tooltip: "Repeat transient"
                            },
                            {
                                value: TransientPlayMode.Pingpong,
                                element: (<Icon symbol={IconSymbol.PlayAlternate}/>),
                                tooltip: "Alternate playback"
                            }
                        ]}/>
            <NumberInput lifecycle={lifecycle}
                         mapper={StringMapping.numeric({unit: "cents"})}
                         className="input"
                         maxChars={4}
                         step={1}
                         model={new DefaultObservableValue(0.0)}/>
            <span>cents</span>
        </div>
    )
}