import css from "./StretchSelector.sass?inline"
import {Html} from "@opendaw/lib-dom"
import {DefaultObservableValue, Lifecycle, Nullable} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {IconSymbol, TransientPlayMode} from "@opendaw/studio-enums"
import {RadioGroup} from "@/ui/components/RadioGroup"
import {Icon} from "@/ui/components/Icon"

const className = Html.adoptStyleSheet(css, "StretchSelector")

type Construct = {
    lifecycle: Lifecycle
}

export const StretchSelector = ({lifecycle}: Construct) => {
    enum PlayModeEnum {NoWarp, Pitch, TimeStretch}

    const playModeEnumValue = new DefaultObservableValue(PlayModeEnum.TimeStretch)
    const transientPlayModeEnumValue = new DefaultObservableValue<Nullable<TransientPlayMode>>(TransientPlayMode.Pingpong)
    return (
        <div className={className}>
            <RadioGroup lifecycle={lifecycle}
                        model={playModeEnumValue}
                        elements={[
                            {
                                value: PlayModeEnum.NoWarp,
                                element: (<span>No</span>),
                                tooltip: "No Warp"
                            },
                            {
                                value: PlayModeEnum.Pitch,
                                element: (<Icon symbol={IconSymbol.Note}/>),
                                tooltip: "Pitch Stretch"
                            },
                            {
                                value: PlayModeEnum.TimeStretch,
                                element: (<Icon symbol={IconSymbol.Time}/>),
                                tooltip: "Time Stretch"
                            }
                        ]}/>
            <hr/>
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
        </div>
    )
}