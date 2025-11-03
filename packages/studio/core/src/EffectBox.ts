import {
    ArpeggioDeviceBox,
    CompressorDeviceBox,
    CrusherDeviceBox,
    DelayDeviceBox,
    TidalDeviceBox,
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
    | DelayDeviceBox | ReverbDeviceBox | RevampDeviceBox | StereoToolDeviceBox | TidalDeviceBox
    | ModularDeviceBox | UnknownAudioEffectDeviceBox | CompressorDeviceBox | CrusherDeviceBox | FoldDeviceBox