import {InaccessibleProperty} from "@opendaw/lib-std"
import {Api} from "@opendaw/studio-scripting"
import {Chord, PPQN} from "@opendaw/lib-dsp"

const openDAW: Api = InaccessibleProperty("Not to be executed.")
/*
TODO:
    * Put execution into a worker and send back the serialized boxes.
    * Add openDAW.getCurrentProject() <- needs to be send to worker and changes should be revertable
    * Get selections (introduce await to talk back to main-thread?)
    * Start a script-editor with selected items and write boiler-plate code to start modifiying them (typed)
    * Save file for exporting
    * Store project in ProjectStorage
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
const project = openDAW.newProject()
const audioUnit = project.addInstrumentUnit("Vaporisateur")
const track = audioUnit.addNoteTrack({enabled: true})
const region = track.addRegion({
    position: 0,
    duration: PPQN.fromSignature(16, 4),
    label: "Hello World"
})
for (let i = 0; i < 64; i++) {
    region.addEvent({
        position: i * PPQN.SemiQuaver,
        pitch: 60 + Chord.Minor[i % 7],
        duration: PPQN.SemiQuaver
    })
}
project.openInStudio()