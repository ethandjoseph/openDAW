import {AudioClipBoxAdapter, AudioRegionBoxAdapter} from "@opendaw/studio-adapters"
import {EmptyExec, Exec, isDefined, panic, RuntimeNotifier, UUID} from "@opendaw/lib-std"
import {Promises} from "@opendaw/lib-runtime"
import {DefaultSampleLoaderManager, Workers} from "@opendaw/studio-core"
import {AudioWarpingBox, TransientMarkerBox, WarpMarkerBox} from "@opendaw/studio-boxes"
import {AudioPlayback} from "@opendaw/studio-enums"
import {BoxGraph} from "@opendaw/lib-box"

export namespace AudioAdapterEditing {
    export const toNoWarp = async (adapters: ReadonlyArray<AudioRegionBoxAdapter | AudioClipBoxAdapter>): Promise<Exec> => {
        const audioAdapters = adapters.filter(adapter => adapter.playback.getValue() !== AudioPlayback.NoSync)
        if (audioAdapters.length === 0) {return EmptyExec}
        let deleteWarpMarkers = false
        if (audioAdapters.filter(adapter => adapter.warping.nonEmpty()).length > 0) {
            deleteWarpMarkers = await RuntimeNotifier
                .approve({headline: "Delete Warp Markers", message: "Do you want to delete the warp markers?"})
        }
        return () => audioAdapters.forEach(adapter => {
            if (deleteWarpMarkers) {
                const warpingPointer = adapter.box.warping
                const warping = warpingPointer.targetVertex.unwrapOrNull()
                warpingPointer.defer()
                if (isDefined(warping)) {
                    warping.box.delete()
                }
            }
            adapter.setPlayback(AudioPlayback.NoSync)
        })
    }

    export const toTimestretch = async (sampleManager: DefaultSampleLoaderManager,
                                        boxGraph: BoxGraph,
                                        adapters: ReadonlyArray<AudioRegionBoxAdapter | AudioClipBoxAdapter>): Promise<Exec> => {
        const audioAdapters = adapters.filter(adapter => adapter.playback.getValue() !== AudioPlayback.Timestretch)
        if (audioAdapters.length === 0) {return EmptyExec}
        const {status, value: warpings, error} = await Promises.tryCatch(Promise.all(audioAdapters
            .filter(adapter => adapter.warping.isEmpty())
            .map(async adapter => {
                const audioData = await sampleManager.getAudioData(adapter.file.uuid)
                const transients = await Workers.Transients.detect(audioData)
                return {audioData, transients, adapter}
            })))
        if (status === "rejected") {return panic(error)}
        return () => {
            warpings.forEach(({audioData, transients, adapter}) => {
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
            audioAdapters.forEach(region => region.setPlayback(AudioPlayback.Timestretch))
        }
    }
}