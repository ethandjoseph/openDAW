import {MutableObservableValue, ObservableOption, Option} from "@opendaw/lib-std"
import {EventCollection, TimeBase} from "@opendaw/lib-dsp"
import {BoxAdapter} from "../BoxAdapter"
import {AudioPlayMode} from "../audio/AudioPlayMode"
import {AudioFileBoxAdapter} from "../audio/AudioFileBoxAdapter"
import {AudioTimeStretchBoxAdapter} from "../audio/AudioTimeStretchBoxAdapter"
import {AudioPitchBoxAdapter} from "../audio/AudioPitchBoxAdapter"
import {WarpMarkerBoxAdapter} from "../audio/WarpMarkerBoxAdapter"

export interface AudioContentBoxAdapter extends BoxAdapter {
    get file(): AudioFileBoxAdapter
    get timeBase(): TimeBase
    get observableOptPlayMode(): ObservableOption<AudioPlayMode>
    get waveformOffset(): MutableObservableValue<number>
    get isPlayModeNoWarp(): boolean
    get asPlayModePitch(): Option<AudioPitchBoxAdapter>
    get asPlayModeTimeStretch(): Option<AudioTimeStretchBoxAdapter>
    get optWarpMarkers(): Option<EventCollection<WarpMarkerBoxAdapter>>
    get gain(): MutableObservableValue<number>
}