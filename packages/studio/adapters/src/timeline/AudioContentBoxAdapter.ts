import {MutableObservableValue, ObservableOption, ObservableValue} from "@opendaw/lib-std"
import {AudioWarpingBoxAdapter} from "../audio/AudioWarpingBoxAdapter"
import {TimeBase} from "@opendaw/lib-dsp"
import {AudioPlayback} from "@opendaw/studio-enums"
import {BoxAdapter} from "../BoxAdapter"

export interface AudioContentBoxAdapter extends BoxAdapter {
    get warping(): ObservableOption<AudioWarpingBoxAdapter>
    get timeBase(): TimeBase
    get playback(): ObservableValue<AudioPlayback>
    get waveformOffset(): MutableObservableValue<number>
}