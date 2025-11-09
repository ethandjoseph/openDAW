import {InaccessibleProperty} from "@opendaw/lib-std"
import {Chord, PPQN} from "@opendaw/lib-dsp"
import {Api} from "@opendaw/studio-adapters"

const openDAW: Api = InaccessibleProperty("Not to be executed.")
/* This code above will not be seen. The two slashes start the example. */

// openDAW script editor (very early preview - under heavy construction)
const project = openDAW.newProject()
const instrument = project.createInstrument("Vaporisateur")
const track = instrument.createNoteTrack()
const region = track.createNoteRegion({position: 0, duration: PPQN.fromSignature(16, 4)}) // 4 bars long in 4/4
for (let i = 0; i < 64; i++) {
    region.createNoteEvent({position: i * PPQN.SemiQuaver, pitch: 60 + Chord.Minor[i % 7]})
}
openDAW.showProject(project, "example")