import {RootBox} from "./RootBox"
import {SelectionBox} from "./SelectionBox"
import {UserInterfaceBox} from "./UserInterface"
import {UploadFileBox} from "./UploadFileBox"
import {TimelineBox} from "./timeline/timeline"
import {TrackBox} from "./timeline/track"
import {NoteClipBox, NoteEventBox, NoteEventCollectionBox, NoteEventRepeatBox, NoteRegionBox} from "./timeline/notes"
import {
    ValueClipBox,
    ValueEventBox,
    ValueEventCollectionBox,
    ValueEventCurveBox,
    ValueRegionBox
} from "./timeline/value"
import {AudioClipBox, AudioRegionBox} from "./timeline/audio"
import {MarkerBox} from "./timeline/marker"
import {AudioFileBox} from "./AudioFileBox"
import {SoundfontFileBox} from "./SoundfontFileBox"
import {AudioBusBox, AudioUnitBox, AuxSendBox} from "./AudioUnitBox"
import {CaptureAudioBox, CaptureMidiBox} from "./CaptureBox"
import {GrooveShuffleBox} from "./GrooveBoxes"

export const Definitions = [
    RootBox, SelectionBox, UserInterfaceBox, UploadFileBox,
    TimelineBox, TrackBox,
    NoteEventBox, NoteEventRepeatBox, NoteEventCollectionBox, NoteRegionBox, NoteClipBox,
    ValueEventBox, ValueEventCollectionBox, ValueEventCurveBox, ValueRegionBox, ValueClipBox,
    AudioRegionBox, AudioClipBox,
    MarkerBox,
    AudioFileBox, SoundfontFileBox,
    AudioUnitBox, CaptureAudioBox, CaptureMidiBox,
    AudioBusBox, AuxSendBox,
    GrooveShuffleBox
]