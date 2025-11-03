import {DelayDeviceBox} from "./audio-effects/DelayDeviceBox"
import {DeviceInterfaceKnobBox, ModularDeviceBox} from "./modular"
import {RevampDeviceBox} from "./audio-effects/RevampDeviceBox"
import {ReverbDeviceBox} from "./audio-effects/ReverbDeviceBox"
import {TapeDeviceBox} from "./instruments/TapeDeviceBox"
import {VaporisateurDeviceBox} from "./instruments/VaporisateurDeviceBox"
import {ArpeggioDeviceBox} from "./midi-effects/ArpeggioDeviceBox"
import {PitchDeviceBox} from "./midi-effects/PitchDeviceBox"
import {NanoDeviceBox} from "./instruments/NanoDeviceBox"
import {PlayfieldDeviceBox, PlayfieldSampleBox} from "./instruments/PlayfieldDeviceBox"
import {StereoToolDeviceBox} from "./audio-effects/StereoToolDeviceBox"
import {ZeitgeistDeviceBox} from "./midi-effects/ZeitGeistDeviceBox"
import {UnknownAudioEffectDevice} from "./audio-effects/UnknownAudioEffectDevice"
import {UnknownMidiEffectDevice} from "./midi-effects/UnknownMidiEffectDevice"
import {SoundfontDeviceBox} from "./instruments/SoundfontDeviceBox"
import {CompressorDeviceBox} from "./audio-effects/CompressorDeviceBox"
import {CrusherDeviceBox} from "./audio-effects/CrusherDeviceBox"
import {FoldDeviceBox} from "./audio-effects/FoldDeviceBox"
import {MIDIOutputDeviceBox} from "./instruments/MIDIOutputDeviceBox"
import {VelocityDeviceBox} from "./midi-effects/VelocityDeviceBox"
import {MIDIOutputBox} from "./instruments/MIDIOutputBox"
import {MIDIOutputParameterBox} from "./instruments/MIDIOutputParameterBox"
import {DuckerDeviceBox} from "./audio-effects/DuckerDeviceBox"

export const DeviceDefinitions = [
    UnknownAudioEffectDevice,
    UnknownMidiEffectDevice,
    DeviceInterfaceKnobBox,
    ModularDeviceBox,
    StereoToolDeviceBox,
    CompressorDeviceBox,
    DelayDeviceBox,
    CrusherDeviceBox,
    VelocityDeviceBox,
    FoldDeviceBox,
    DuckerDeviceBox,
    RevampDeviceBox,
    ReverbDeviceBox,
    VaporisateurDeviceBox,
    MIDIOutputDeviceBox,
    MIDIOutputBox,
    MIDIOutputParameterBox,
    SoundfontDeviceBox,
    NanoDeviceBox,
    PlayfieldDeviceBox,
    PlayfieldSampleBox,
    TapeDeviceBox,
    ArpeggioDeviceBox,
    PitchDeviceBox,
    ZeitgeistDeviceBox
]