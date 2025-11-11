import {InaccessibleProperty} from "@opendaw/lib-std"
import {Api} from "@opendaw/studio-scripting"

const openDAW: Api = InaccessibleProperty("Not to be executed.")
/*
TODO:
    * Put execution into a worker and send back the serialized boxes.
    * Add openDAW.getCurrentProject() <- needs to be send to worker and changes should be revertable
    * Get selections (introduce await to talk back to main-thread?)
    * Start a script-editor with selected items and write boiler-plate code to start modifiying them (typed)
    * Save file
    * Add a way to create effects (midi, audio)
    * Add a way to create buses and connect them
    * Add a way to query and set values in boxes (typed)
    * Add a way to query available samples and soundfonts
    * Add mirrored regions
    * Add Automation
    * Add Audio (also create audio files by code)
    * Add Clips
    * AudioUnits without any track should be shown in timeline

    This code above will not be seen. The two slashes start the example.
*/
// openDAW script editor (very early preview - under heavy construction)
const project = openDAW.addProject()
const audioUnit = project.addInstrumentUnit("Vaporisateur")
// audioUnit.addAudioEffect("delay", {feedback: "50%"})
audioUnit.addNoteTrack({enabled: false})
// const region = track.addRegion({position: 0, duration: PPQN.fromSignature(16, 4)}) // 4 bars long in 4/4
// for (let i = 0; i < 64; i++) {
//     region.addEvent({position: i * PPQN.SemiQuaver, pitch: 60 + Chord.Minor[i % 7]})
// }
project.openInStudio()