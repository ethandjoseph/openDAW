import css from "./ShadertoyEditor.sass?inline"
import {Html} from "@opendaw/lib-dom"
import {Lifecycle} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {StudioService} from "@/service/StudioService"

const className = Html.adoptStyleSheet(css, "ShadertoyEditor")

type Construct = {
    lifecycle: Lifecycle
    service: StudioService
}

export const ShadertoyEditor = ({}: Construct) => {
    return (
        <div className={className}></div>
    )
}