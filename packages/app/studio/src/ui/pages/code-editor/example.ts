import {InaccessibleProperty} from "@opendaw/lib-std"
import {Api} from "@opendaw/studio-scripting"
import {PPQN} from "@opendaw/lib-dsp"

const openDAW: Api = InaccessibleProperty("Not to be executed.")
/*
TODO:
    * Dialogs or a console
    * Add openDAW.getCurrentProject() <- needs to be send to worker and changes should be revertable
    * Get selections (introduce await to talk back to main-thread?)
    * Start a script-editor with selected items and write boiler-plate code to start modifiying them (typed)
    * Save file for exporting
    * Store project in ProjectStorage
    * Add a way to query and set values in boxes (typed)
    * Add a way to query available samples and soundfonts
    * Add Audio (also create audio files by code)
    * Add Clips
    * Verify outcome
    * AudioUnits without any track should be shown in timeline
    -------------------------------------------------------------------
    This code above will not be exposed. The two slashes start the example.
    Everything you import here, must be exported in the Api and globals too.
*/
// openDAW script editor (very early preview - under heavy construction)

export {}

const numberOfFrames = sampleRate
const frames = new Float32Array(numberOfFrames)
const f0 = 200.0  // starting frequency in Hz
const f1 = 4000.0 // ending frequency in Hz
for (let i = 0, phase = 0.0; i < numberOfFrames; i++) {
    frames[i] = Math.sin(phase * Math.PI * 2.0)
    const t = i / numberOfFrames
    const freq = f0 * Math.pow(f1 / f0, t)
    phase += freq / sampleRate
}

const sample = await openDAW.addSample({
    frames: [frames],
    numberOfFrames,
    numberOfChannels: 1,
    sampleRate
}, "Chirp 200-4000Hz")

const project = openDAW.newProject("Test Audio")
const tapeUnit = project.addInstrumentUnit("Tape")
const audioTrack = tapeUnit.addAudioTrack()
audioTrack.addRegion(sample, {duration: PPQN.samplesToPulses(numberOfFrames, project.bpm, sampleRate)})
project.openInStudio()