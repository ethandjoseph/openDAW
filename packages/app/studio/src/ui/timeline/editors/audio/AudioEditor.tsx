import css from "./AudioEditor.sass?inline"
import {Lifecycle} from "@opendaw/lib-std"
import {createElement, Frag} from "@opendaw/lib-jsx"
import {StudioService} from "@/service/StudioService.ts"
import {AudioEditorCanvas} from "@/ui/timeline/editors/audio/AudioEditorCanvas.tsx"
import {TimelineRange} from "@opendaw/studio-core"
import {Snapping} from "@/ui/timeline/Snapping.ts"
import {EditorMenuCollector} from "@/ui/timeline/editors/EditorMenuCollector.ts"
import {AudioEventOwnerReader} from "@/ui/timeline/editors/EventOwnerReader.ts"
import {Html} from "@opendaw/lib-dom"

const className = Html.adoptStyleSheet(css, "AudioEditor")

type Construct = {
    lifecycle: Lifecycle
    service: StudioService
    menu: EditorMenuCollector
    range: TimelineRange
    snapping: Snapping
    reader: AudioEventOwnerReader
}

export const AudioEditor = ({lifecycle, service, range, snapping, reader}: Construct) => {
    return (
        <div className={className}>
            <Frag>
                <div><h5>Transients</h5></div>
                <div><h5>Warp Markers</h5></div>
                <div><h5>Waveform</h5></div>
            </Frag>
            <Frag>
                <div/>
                <div/>
                <AudioEditorCanvas lifecycle={lifecycle}
                                   service={service}
                                   range={range}
                                   snapping={snapping}
                                   reader={reader}/>
            </Frag>
        </div>
    )
}