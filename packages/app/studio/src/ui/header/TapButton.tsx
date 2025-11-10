import css from "./TapButton.sass?inline"
import {Html} from "@opendaw/lib-dom"
import {createElement} from "@opendaw/lib-jsx"
import {PPQN} from "@opendaw/lib-dsp"
import {ProjectProfileService} from "@/service/ProjectProfileService"

const className = Html.adoptStyleSheet(css, "TapButton")

type Construct = {
    profileService: ProjectProfileService
}

export const TapButton = ({profileService}: Construct) => {
    let lastTapTime = performance.now()
    let lastMeasuredBpm = 0.0
    let lastFilteredBpm = 0.0
    return (
        <div className={className} onpointerdown={(event) => {
            const tapTime = event.timeStamp
            const differenceInSeconds = (tapTime - lastTapTime) / 1000.0
            const quarter = PPQN.fromSignature(1, 4)
            const measuredBpm = PPQN.secondsToBpm(differenceInSeconds, quarter)
            const ratio = lastMeasuredBpm / measuredBpm
            const percentOff = Math.abs(Math.log10(ratio)) * 100.0
            if (percentOff > 5.0) {
                // reset value
                lastFilteredBpm = measuredBpm
            } else {
                // smooth exponentially
                const coeff = 0.125
                lastFilteredBpm *= Math.pow(measuredBpm / lastFilteredBpm, coeff)
                profileService.getValue()
                    .ifSome(({project: {editing, timelineBox: {bpm}}}) =>
                        editing.modify(() => bpm.setValue(lastFilteredBpm), false))
            }
            lastTapTime = tapTime
            lastMeasuredBpm = measuredBpm
        }}>TAP</div>
    )
}