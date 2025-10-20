import "./style.sass"
import {assert, DefaultParameter, StringMapping, Terminator, ValueMapping} from "@opendaw/lib-std"
import {createElement, replaceChildren} from "@opendaw/lib-jsx"
import {Knob} from "@opendaw/app-studio/src/ui/components/Knob"

(async () => {
    assert(crossOriginIsolated, "window must be crossOriginIsolated")
    console.debug("openDAW Lab")

    const audioContext = new AudioContext()
    await audioContext.suspend()
    await audioContext.audioWorklet.addModule(new URL("./proc-osc-polyblip.ts", import.meta.url))
    const oscillatorNode = new AudioWorkletNode(audioContext, "proc-osc-polyblip")
    oscillatorNode.connect(audioContext.destination)

    window.addEventListener("click", () => {
        if (audioContext.state === "suspended") {
            audioContext.resume()
        } else {
            audioContext.suspend()
        }
    }, {capture: true})

    const lifeCycle = new Terminator()

    const frequency = new DefaultParameter(
        ValueMapping.exponential(20, 2000),
        StringMapping.numeric(), "Frequency", 2000.0)
    replaceChildren(document.body, (
        <div>
            <span>Hello Oscillator</span>
            <Knob lifecycle={lifeCycle} value={frequency} anchor={0.0}/>
        </div>
    ))
})()