import {InaccessibleProperty} from "@opendaw/lib-std"
import {Api} from "@opendaw/studio-scripting"
import {Chord, Interpolation, PPQN} from "@opendaw/lib-dsp"

const openDAW: Api = InaccessibleProperty("Not to be executed.")
/*
TODO:
    * Put execution into a worker and send back the serialized boxes.
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
const vapo = project.addInstrumentUnit("Vaporisateur")
vapo.volume = -3.0 // -3db
vapo.panning = 0.5 // 50% right
vapo.mute = true
vapo.solo = true
vapo.addMIDIEffect("pitch", {octaves: 1, label: "Up"})
const pitch = vapo.addMIDIEffect("pitch", {octaves: -1, label: "Down"})
{
    const track = vapo.addValueTrack(pitch, "cents")
    const region = track.addRegion({duration: PPQN.Bar * 4})
    region.addEvent({position: 0, value: 0.5, interpolation: Interpolation.None})
    region.addEvent({position: PPQN.Bar * 2, value: 0.0, interpolation: Interpolation.Curve(0.25)})
    region.addEvent({position: PPQN.Bar * 4, value: 1.0})
}
{
    const track = vapo.addNoteTrack({enabled: true})
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
    track.addRegion({
        position: PPQN.fromSignature(16, 4),
        duration: PPQN.fromSignature(16, 4),
        hue: 270,
        mute: true,
        loopDuration: PPQN.Bar,
        label: "Scripted Region", mirror: region
    })
}
project.openInStudio()