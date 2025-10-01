import css from "./SoftwareMIDIPanel.sass?inline"
import {Events, Html} from "@opendaw/lib-dom"
import {Lifecycle} from "@opendaw/lib-std"
import {createElement, Frag} from "@opendaw/lib-jsx"
import {PianoRollLayout} from "@/ui/PianoRollLayout"
import {PianoKeyCodes} from "@/ui/software-midi/Mapping"
import {MidiDevices} from "@opendaw/studio-core"

const className = Html.adoptStyleSheet(css, "SoftwareMIDIPanel")

type Construct = {
    lifecycle: Lifecycle
}

export const SoftwareMIDIPanel = ({lifecycle}: Construct) => {
    const {WhiteKey, BlackKey} = PianoRollLayout
    const pianoLayout = new PianoRollLayout(0, 12)
    const element: HTMLElement = (
        <div className={className} tabIndex={-1}>
            <svg
                viewBox={`0.5 0 ${pianoLayout.whiteKeys.length * WhiteKey.width - 1} ${(WhiteKey.height)}`}
                width="200px">
                {pianoLayout.whiteKeys.map(({key, x}) => (
                    <Frag>
                        <rect classList="white" data-key={key} x={x + 0.5} y={0}
                              width={WhiteKey.width - 1} height={WhiteKey.height}/>
                        <text x={(x + WhiteKey.width / 2).toString()}
                              y={(WhiteKey.height - 4).toString()}
                              fill="black"
                              font-size="10px"
                              text-anchor="middle"
                              dominant-baseline="alphabetic">
                            {PianoKeyCodes[key].at(-1)}
                        </text>
                    </Frag>
                ))}
                {pianoLayout.blackKeys.map(({key, x}) => (
                    <Frag>
                        <rect classList="black" data-key={key} x={x} y={0}
                              width={BlackKey.width} height={BlackKey.height}/>
                        <text x={(x + BlackKey.width / 2).toString()}
                              y={(BlackKey.height - 4).toString()}
                              fill="white"
                              font-size="10px"
                              text-anchor="middle"
                              dominant-baseline="alphabetic">
                            {PianoKeyCodes[key].at(-1)}
                        </text>
                    </Frag>
                ))}
            </svg>
        </div>
    )
    // TODO pointer down and move
    // TODO highlight keys when played
    // TODO show focus
    // TODO indicator that nobody is listening
    // TODO octave switcher (numeric stepper)
    // TODO panic?
    lifecycle.ownAll(
        Events.subscribe(window, "keydown", event => {
            if (event.repeat) {return}
            const index = PianoKeyCodes.indexOf(event.code)
            if (index >= 0 && index <= 12) {
                MidiDevices.softwareMIDIInput.sendNoteOnEvent(index + 60)
                event.stopImmediatePropagation()
            }
        }, {capture: true}),
        Events.subscribe(window, "keyup", event => {
            const index = PianoKeyCodes.indexOf(event.code)
            if (index >= 0 && index <= 12) {
                MidiDevices.softwareMIDIInput.sendNoteOffEvent(index + 60)
                event.stopImmediatePropagation()
            }
        }, {capture: true})
    )
    return element
}