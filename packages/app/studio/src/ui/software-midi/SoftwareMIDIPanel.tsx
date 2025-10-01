import css from "./SoftwareMIDIPanel.sass?inline"
import {Events, Html} from "@opendaw/lib-dom"
import {byte, clamp, DefaultObservableValue, Lifecycle, ParseResult, StringResult} from "@opendaw/lib-std"
import {createElement, DomElement, Frag} from "@opendaw/lib-jsx"
import {PianoRollLayout} from "@/ui/PianoRollLayout"
import {PianoKeyCodes} from "@/ui/software-midi/Mapping"
import {Colors, MidiDevices} from "@opendaw/studio-core"
import {NumberInput} from "@/ui/components/NumberInput"
import {MenuButton} from "@/ui/components/MenuButton"
import {MenuItem} from "@/ui/model/menu-item"
import {Icon} from "@/ui/components/Icon"
import {IconSymbol} from "@opendaw/studio-adapters"
import {MidiData} from "@opendaw/lib-midi"

const className = Html.adoptStyleSheet(css, "SoftwareMIDIPanel")

type Construct = {
    lifecycle: Lifecycle
}

// TODO pointer down and move
// TODO Resize panel is coming through
// TODO indicator that nobody is listening
// TODO Target selector
// TODO Draggable panel
// TODO Allow setting own dimensions in PianoRollLayout
// TODO panic -> release all notes?

export const SoftwareMIDIPanel = ({lifecycle}: Construct) => {
    const {WhiteKey, BlackKey} = PianoRollLayout
    const pianoLayout = new PianoRollLayout(0, 12)
    const octave = new DefaultObservableValue(4)
    const channel = new DefaultObservableValue(0)
    const svg: SVGElement = (
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
    )
    const midiIndicator: DomElement = <Icon symbol={IconSymbol.DinSlot}/>
    const element: HTMLElement = (
        <div className={className}>
            <h3>Software MIDI</h3>
            <div className="controls">
                <span>Octave</span>
                <NumberInput lifecycle={lifecycle} model={octave} mapper={{
                    x: (y: byte): StringResult => ({unit: "", value: y.toString()}),
                    y: (x: string): ParseResult<byte> => ({type: "explicit", value: clamp(parseInt(x), -2, 6)})
                }}/>
                <span>Channel</span>
                <NumberInput lifecycle={lifecycle} model={channel} mapper={{
                    x: (y: byte): StringResult => ({unit: "", value: (y + 1).toString()}),
                    y: (x: string): ParseResult<byte> => ({type: "explicit", value: clamp(parseInt(x) - 1, 1, 14)})
                }}/>
                <MenuButton root={MenuItem.root().setRuntimeChildrenProcedure(parent => parent.addMenuItem(
                    MenuItem.default({label: "Hello World"})
                ))}>{midiIndicator}</MenuButton>
            </div>
            {svg}
        </div>
    )
    lifecycle.ownAll(
        Events.subscribe(MidiDevices.softwareMIDIInput, "midimessage", event => {
            MidiData.accept(event.data, {
                noteOn: (note: byte, _velocity: byte) => svg.querySelector(`[data-key="${note - 60}"]`)
                    ?.classList.add("active"),
                noteOff: (note: byte) => svg.querySelector(`[data-key="${note - 60}"]`)
                    ?.classList.remove("active")
            })
        }),
        MidiDevices.softwareMIDIInput.countListeners
            .catchupAndSubscribe(owner => midiIndicator.style.color = owner.getValue() > 1 ? Colors.green : Colors.red),
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
        }, {capture: true}),
        Events.subscribe(element, "pointermove", event => {
            console.debug("pointermove", event.target)
            event.preventDefault()
            event.stopImmediatePropagation()
        }, {capture: true})
    )
    return element
}