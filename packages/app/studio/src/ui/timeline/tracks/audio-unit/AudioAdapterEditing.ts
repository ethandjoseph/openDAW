import {AudioClipBoxAdapter, AudioRegionBoxAdapter} from "@opendaw/studio-adapters"
import {EmptyExec, Exec, isDefined, panic} from "@opendaw/lib-std"
import {Promises} from "@opendaw/lib-runtime"
import {DefaultSampleLoaderManager, Workers} from "@opendaw/studio-core"
import {AudioPlayback} from "@opendaw/studio-enums"
import {BoxGraph} from "@opendaw/lib-box"

export namespace AudioAdapterEditing {
    export const toNoWarp = async (adapters: ReadonlyArray<AudioRegionBoxAdapter | AudioClipBoxAdapter>): Promise<Exec> => {
        const audioAdapters = adapters.filter(adapter => !adapter.isPlayModeNoWarp)
        if (audioAdapters.length === 0) {return EmptyExec}
        return () => audioAdapters.forEach(adapter => {
            const playModePointer = adapter.box.playMode
            const playMode = playModePointer.targetVertex.unwrapOrNull()
            playModePointer.defer()
            if (isDefined(playMode)) {
                playMode.box.delete()
            }
            adapter.setPlayback(AudioPlayback.NoSync)
        })
    }

    export const toTimestretch = async (sampleManager: DefaultSampleLoaderManager,
                                        _boxGraph: BoxGraph,
                                        adapters: ReadonlyArray<AudioRegionBoxAdapter | AudioClipBoxAdapter>): Promise<Exec> => {
        const audioAdapters = adapters.filter(adapter => adapter.asPlayModeTimeStretch.isEmpty())
        if (audioAdapters.length === 0) {return EmptyExec}
        const {status, error} = await Promises.tryCatch(Promise.all(audioAdapters
            .filter(adapter => adapter.optWarpMarkers.isEmpty())
            .map(async adapter => {
                const audioData = await sampleManager.getAudioData(adapter.file.uuid)
                const transients = await Workers.Transients.detect(audioData)
                return {audioData, transients, adapter}
            })))
        if (status === "rejected") {return panic(error)}
        return () => {
            // TODO
            /*warpings.forEach(({audioData, transients, adapter}) => {
                const audioWarpingBox = AudioWarpingBox.create(boxGraph, UUID.generate())
                transients.forEach(position => TransientMarkerBox.create(boxGraph, UUID.generate(), box => {
                    box.owner.refer(audioWarpingBox.transientMarkers)
                    box.position.setValue(position)
                }))
                WarpMarkerBox.create(boxGraph, UUID.generate(), box => {
                    box.owner.refer(audioWarpingBox.warpMarkers)
                    box.position.setValue(0)
                    box.seconds.setValue(0)
                })
                WarpMarkerBox.create(boxGraph, UUID.generate(), box => {
                    box.owner.refer(audioWarpingBox.warpMarkers)
                    box.position.setValue(adapter instanceof AudioRegionBoxAdapter
                        ? adapter.loopDuration
                        : adapter.duration)
                    box.seconds.setValue(audioData.numberOfFrames / audioData.sampleRate)
                })
                adapter.box.warping.refer(audioWarpingBox)
            })
            audioAdapters.forEach(region => region.setPlayback(AudioPlayback.Timestretch))*/
        }
    }
}