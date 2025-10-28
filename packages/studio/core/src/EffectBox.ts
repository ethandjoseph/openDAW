import {
    ArpeggioDeviceBox,
    CompressorDeviceBox,
    CrusherDeviceBox,
    DelayDeviceBox,
    FoldDeviceBox,
    ModularDeviceBox,
    PitchDeviceBox,
    RevampDeviceBox,
    ReverbDeviceBox,
    StereoToolDeviceBox,
    UnknownAudioEffectDeviceBox,
    UnknownMidiEffectDeviceBox,
    VelocityDeviceBox,
    ZeitgeistDeviceBox
} from "@opendaw/studio-boxes"

export type EffectBox =
    | ArpeggioDeviceBox | PitchDeviceBox | VelocityDeviceBox | ZeitgeistDeviceBox | UnknownMidiEffectDeviceBox
    | DelayDeviceBox | ReverbDeviceBox | RevampDeviceBox | StereoToolDeviceBox
    | ModularDeviceBox | UnknownAudioEffectDeviceBox | CompressorDeviceBox | CrusherDeviceBox | FoldDeviceBox