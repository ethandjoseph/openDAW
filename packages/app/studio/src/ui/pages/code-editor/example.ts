import {Api} from "@opendaw/studio-adapters"
import {InaccessibleProperty} from "@opendaw/lib-std"
import {PPQN} from "@opendaw/lib-dsp"

const openDAW: Api = InaccessibleProperty("Not to be executed.")
/* This code above will not be seen. The two slashes start the example. */

// openDAW script editor (very early preview - under heavy construction)
const factory = openDAW.createProjectFactory()
const instrument = factory.createInstrument("Vaporisateur")
const track = instrument.createNoteTrack()
const region = track.createNoteRegion({position: 0, duration: PPQN.fromSignature(16, 4)}) // 4 bars long in 4/4
const major = [0, 2, 4, 5, 7, 9, 11]
for (let i = 0; i < 64; i++) {
    region.createNoteEvent({position: i * PPQN.SemiQuaver, pitch: 60 + major[i % 7]})
}
factory.create("example")
openDAW.exitEditor()