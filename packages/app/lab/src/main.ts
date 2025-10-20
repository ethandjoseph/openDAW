import "./style.css"
import {assert} from "@opendaw/lib-std"

/**
 * Example project for testing import samples.
 */
(async () => {
    assert(crossOriginIsolated, "window must be crossOriginIsolated")
    console.debug("booting...")
    console.debug("openDAW Lab")

    const audioContext = new AudioContext()
    await audioContext.audioWorklet.addModule(new URL("./proc-osc-polyblip.ts", import.meta.url))
    const oscillatorNode = new AudioWorkletNode(audioContext, "proc-osc-polyblip")
    oscillatorNode.connect(audioContext.destination)

    if (audioContext.state === "suspended") {
        window.addEventListener("click",
            async () => await audioContext.resume().then(() =>
                console.debug(`AudioContext resumed (${audioContext.state})`)), {capture: true, once: true})
    }
})()