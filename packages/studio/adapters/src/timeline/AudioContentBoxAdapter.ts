import {MutableObservableValue, ObservableOption, Option} from "@opendaw/lib-std"
import {EventCollection, ppqn, TimeBase} from "@opendaw/lib-dsp"
import {BoxAdapter} from "../BoxAdapter"
import {AudioPlayMode} from "../audio/AudioPlayMode"
import {AudioFileBoxAdapter} from "../audio/AudioFileBoxAdapter"
import {AudioTimeStretchBoxAdapter} from "../audio/AudioTimeStretchBoxAdapter"
import {AudioPitchBoxAdapter} from "../audio/AudioPitchBoxAdapter"
import {WarpMarkerBoxAdapter} from "../audio/WarpMarkerBoxAdapter"
import {AudioClipBox, AudioRegionBox} from "@opendaw/studio-boxes"

export interface AudioContentBoxAdapter extends BoxAdapter {
    get file(): AudioFileBoxAdapter
    get timeBase(): TimeBase
    get duration(): ppqn
    get observableOptPlayMode(): ObservableOption<AudioPlayMode>
    get waveformOffset(): MutableObservableValue<number>
    get isPlayModeNoWarp(): boolean
    get asPlayModePitch(): Option<AudioPitchBoxAdapter>
    get asPlayModeTimeStretch(): Option<AudioTimeStretchBoxAdapter>
    get optWarpMarkers(): Option<EventCollection<WarpMarkerBoxAdapter>>
    get gain(): MutableObservableValue<number>
    get box(): AudioClipBox | AudioRegionBox
}