import {Api} from "@opendaw/studio-adapters"
import {InaccessibleProperty} from "@opendaw/lib-std"
import {PPQN} from "@opendaw/lib-dsp"

const openDAW: Api = InaccessibleProperty("Not to be executed.")

// openDAW script editor
const factory = openDAW.createProjectFactory()
const instrument = factory.createInstrument("Nano")
const noteTrack = instrument.createNoteTrack()
noteTrack.createNoteRegion({position: 0, duration: PPQN.Bar})
factory.render("example")