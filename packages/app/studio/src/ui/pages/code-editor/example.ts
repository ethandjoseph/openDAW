import {Api} from "@opendaw/studio-adapters"
import {InaccessibleProperty} from "@opendaw/lib-std"
import {PPQN} from "@opendaw/lib-dsp"

const openDAW: Api = InaccessibleProperty("Not to be executed.")
/* This code above will not be seen. The two slashes start the example. */

// openDAW script editor (very early preview - under heavy construction)
const factory = openDAW.createProjectFactory()
const instrument = factory.createInstrument("Nano")
const noteTrack = instrument.createNoteTrack()
noteTrack.createNoteRegion({position: 0, duration: PPQN.fromSignature(16, 4)}) // 4 bars long in 4/4
factory.render("example")