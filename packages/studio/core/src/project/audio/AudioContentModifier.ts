import {AudioClipBoxAdapter, AudioRegionBoxAdapter} from "@opendaw/studio-adapters"
import {EmptyExec, Exec, isInstanceOf, panic, UUID} from "@opendaw/lib-std"
import {TimeBase} from "@opendaw/lib-dsp"
import {AudioPitchBox, AudioRegionBox, AudioTimeStretchBox, WarpMarkerBox} from "@opendaw/studio-boxes"
import {AudioContentHelpers} from "./AudioContentHelpers"

export namespace AudioContentModifier {
    type AudioContentOwner = AudioRegionBoxAdapter | AudioClipBoxAdapter

    export const toNotStretched = async (adapters: ReadonlyArray<AudioContentOwner>): Promise<Exec> => {
        const audioAdapters = adapters.filter(adapter => !adapter.isPlayModeNoWarp)
        if (audioAdapters.length === 0) {return EmptyExec}
        return () => audioAdapters.forEach((adapter) => {
            adapter.box.playMode.defer()
            switchTimeBaseToSeconds(adapter)
        })
    }

    export const toPitchStretch = async (adapters: ReadonlyArray<AudioContentOwner>): Promise<Exec> => {
        const audioAdapters = adapters.filter(adapter => adapter.asPlayModePitch.isEmpty())
        if (audioAdapters.length === 0) {return EmptyExec}
        return () => audioAdapters.forEach((adapter) => {
            const optTimeStretch = adapter.asPlayModeTimeStretch
            const boxGraph = adapter.box.graph
            const pitchStretch = AudioPitchBox.create(boxGraph, UUID.generate())
            adapter.box.playMode.refer(pitchStretch)
            if (optTimeStretch.nonEmpty()) {
                const timeStretch = optTimeStretch.unwrap()
                if (timeStretch.box.pointerHub.isEmpty()) {
                    timeStretch.warpMarkers.asArray()
                        .forEach(({box: {owner}}) => owner.refer(pitchStretch.warpMarkers))
                    timeStretch.box.delete()
                } else {
                    timeStretch.warpMarkers.asArray()
                        .forEach(({box: source}) => WarpMarkerBox.create(boxGraph, UUID.generate(), box => {
                            box.position.setValue(source.position.getValue())
                            box.seconds.setValue(source.seconds.getValue())
                            box.owner.refer(pitchStretch.warpMarkers)
                        }))
                }
            } else {
                AudioContentHelpers.addDefaultWarpMarkers(boxGraph, pitchStretch, adapter.duration, adapter.file.endInSeconds)
            }
            switchTimeBaseToMusical(adapter)
        })
    }

    export const toTimeStretch = async (adapters: ReadonlyArray<AudioContentOwner>): Promise<Exec> => {
        const audioAdapters = adapters.filter(adapter => adapter.asPlayModeTimeStretch.isEmpty())
        if (audioAdapters.length === 0) {return EmptyExec}
        return () => audioAdapters.forEach(adapter => {
            if (adapter.file.transients.length() < 2) {
                return panic("Does not have transients")
            }
            const optPitchStretch = adapter.asPlayModePitch
            const boxGraph = adapter.box.graph
            const timeStretch = AudioTimeStretchBox.create(boxGraph, UUID.generate())
            adapter.box.playMode.refer(timeStretch)
            if (optPitchStretch.nonEmpty()) {
                const pitchStretch = optPitchStretch.unwrap()
                if (pitchStretch.box.pointerHub.isEmpty()) {
                    pitchStretch.warpMarkers.asArray()
                        .forEach(({box: {owner}}) => owner.refer(timeStretch.warpMarkers))
                    pitchStretch.box.delete()
                } else {
                    pitchStretch.warpMarkers.asArray()
                        .forEach(({box: source}) => WarpMarkerBox.create(boxGraph, UUID.generate(), box => {
                            box.position.setValue(source.position.getValue())
                            box.seconds.setValue(source.seconds.getValue())
                            box.owner.refer(timeStretch.warpMarkers)
                        }))
                }
            } else {
                AudioContentHelpers.addDefaultWarpMarkers(boxGraph, timeStretch, adapter.duration, adapter.file.endInSeconds)
            }
            switchTimeBaseToMusical(adapter)
        })
    }

    const switchTimeBaseToSeconds = ({box, file, timeBase}: AudioContentOwner): void => {
        if (timeBase === TimeBase.Seconds) {return}
        // Reset to 100% playback speed (original file speed)
        box.timeBase.setValue(TimeBase.Seconds)
        box.duration.setValue(file.endInSeconds)
        box.accept({
            visitAudioRegionBox: (box: AudioRegionBox) => {
                box.loopOffset.setValue(0)
                box.loopDuration.setValue(file.endInSeconds)
            }
        })
    }

    const switchTimeBaseToMusical = (adapter: AudioContentOwner): void => {
        const {timeBase} = adapter
        if (timeBase === TimeBase.Musical) {return}
        const {box} = adapter
        box.timeBase.setValue(TimeBase.Musical)
        box.duration.setValue(adapter.duration)
        if (isInstanceOf(adapter, AudioRegionBoxAdapter)) {
            const {box: {duration, loopDuration, loopOffset, timeBase}} = adapter
            timeBase.setValue(TimeBase.Musical)
            duration.setValue(adapter.duration)
            loopOffset.setValue(adapter.loopOffset)
            loopDuration.setValue(adapter.loopDuration)
        }
    }
}