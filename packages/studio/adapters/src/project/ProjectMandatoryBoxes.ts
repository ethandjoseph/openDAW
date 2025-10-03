import {AudioBusBox, AudioUnitBox, RootBox, TimelineBox, UserInterfaceBox} from "@opendaw/studio-boxes"

export type ProjectMandatoryBoxes = {
    rootBox: RootBox
    timelineBox: TimelineBox
    masterBusBox: AudioBusBox
    masterAudioUnit: AudioUnitBox
    userInterfaceBox: UserInterfaceBox
}