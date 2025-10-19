import css from "./PreferencePanel.sass?inline"
import {Html} from "@opendaw/lib-dom"
import {DefaultObservableValue, Lifecycle} from "@opendaw/lib-std"
import {createElement, Frag} from "@opendaw/lib-jsx"
import {Colors, Preferences} from "@opendaw/studio-core"
import {Checkbox} from "@/ui/components/Checkbox"
import {IconSymbol} from "@opendaw/studio-adapters"
import {Icon} from "@/ui/components/Icon"

const className = Html.adoptStyleSheet(css, "PreferencePanel")

type Construct = {
    lifecycle: Lifecycle
}

const Labels: Record<keyof Preferences, string> = {
    "auto-open-clips": "Always open clip view",
    "auto-create-output-compressor": "Automatically add compressor to main output"
}

export const PreferencePanel = ({lifecycle}: Construct) => {
    return (
        <div className={className}>
            {Object.entries(Preferences.Default).map(([key, value]) => {
                const pKey = key as keyof Preferences
                const model = new DefaultObservableValue(value)
                lifecycle.own(model.subscribe(owner => Preferences.Default[pKey] = owner.getValue()))
                return (
                    <Frag>
                        <Checkbox lifecycle={lifecycle}
                                  model={model}
                                  appearance={{activeColor: Colors.purple, cursor: "pointer"}}>
                            <span style={{color: Colors.dark}}>{Labels[pKey]}</span>
                            <hr/>
                            <Icon symbol={IconSymbol.Checkbox}/>
                        </Checkbox>
                    </Frag>
                )
            })}
        </div>
    )
}