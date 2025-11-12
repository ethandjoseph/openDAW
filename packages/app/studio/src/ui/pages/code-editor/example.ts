import {InaccessibleProperty} from "@opendaw/lib-std"
import {Chord, Interpolation, PPQN} from "@opendaw/lib-dsp"
import {Api} from "@opendaw/studio-scripting"

const openDAW: Api = InaccessibleProperty("Not to be executed.")
/*
TODO:
    * Dialogs or a console
    * Add openDAW.getCurrentProject() <- needs to be send to worker and changes should be revertable
    * Get selections (introduce await to talk back to main-thread?)
    * Start a script-editor with selected items and write boiler-plate code to start modifiying them (typed)
    * Save file for exporting
    * Store project in ProjectStorage
    * Add a way to create buses and connect them
    * Add a way to query and set values in boxes (typed)
    * Add a way to query available samples and soundfonts
    * Add Audio (also create audio files by code)
    * Add Clips
    * Verify outcome
    * AudioUnits without any track should be shown in timeline
    -------------------------------------------------------------------
    This code above will not be seen. The two slashes start the example.
    Everything you import here, must be exported in the Api and globals too.
*/
// openDAW script editor (very early preview - under heavy construction)
const project = openDAW.newProject("Hello World")
project.bpm = 125.0
const vapoUnit = project.addInstrumentUnit("Vaporisateur")
vapoUnit.volume = -3.0 // -3db
vapoUnit.panning = 0.5 // 50% right
vapoUnit.mute = false
vapoUnit.solo = false
const groupUnit = project.addGroupUnit()
vapoUnit.output = groupUnit

vapoUnit.addMIDIEffect("pitch", {octaves: 1, label: "Up"})
const pitch = vapoUnit.addMIDIEffect("pitch", {octaves: -1, label: "Down"})
{
    const track = vapoUnit.addValueTrack(vapoUnit, "panning")
    const region = track.addRegion({loopDuration: PPQN.Bar * 2, duration: PPQN.Bar * 4})
    region.addEvent({position: 0, value: 1.0})
    region.addEvent({position: PPQN.Bar, value: 0.0})
    region.addEvent({position: PPQN.Bar * 2, value: 1.0})
}
{
    const track = vapoUnit.addValueTrack(pitch, "cents")
    const region = track.addRegion({duration: PPQN.Bar * 4})
    region.addEvent({position: 0, value: 0.5, interpolation: Interpolation.None})
    region.addEvent({position: PPQN.Bar * 2, value: 0.0, interpolation: Interpolation.Curve(0.25)})
    region.addEvent({position: PPQN.Bar * 4, value: 1.0})
}
{
    const track = vapoUnit.addNoteTrack({enabled: true})
    const region = track.addRegion({
        position: 0,
        duration: PPQN.fromSignature(16, 4),
        label: "Scripted Region"
    })
    for (let i = 0; i < 64; i++) {
        region.addEvent({
            position: i * PPQN.SemiQuaver,
            pitch: 60 + Chord.Minor[i % 7],
            duration: PPQN.SemiQuaver
        })
    }
}
project.openInStudio()