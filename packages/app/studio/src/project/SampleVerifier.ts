import {Errors, panic, RuntimeNotifier, UUID} from "@opendaw/lib-std"
import {BoxGraph} from "@opendaw/lib-box"
import {Promises} from "@opendaw/lib-runtime"
import {AudioFileBox} from "@opendaw/studio-boxes"
import {Sample, SampleLoaderManager} from "@opendaw/studio-adapters"
import {OpenSampleAPI, SampleService, SampleStorage} from "@opendaw/studio-core"
import {SampleDialogs} from "@/ui/browse/SampleDialogs"

export namespace SampleVerifier {
    export const verify = async (boxGraph: BoxGraph,
                                 sampleService: SampleService,
                                 sampleManager: SampleLoaderManager) => {
        const boxes = boxGraph.boxes().filter((box) => box instanceof AudioFileBox)
        if (boxes.length > 0) {
            // check for missing samples
            const online = UUID.newSet<{ uuid: UUID.Bytes, sample: Sample }>(x => x.uuid)
            online.addMany((await OpenSampleAPI.get().all()).map(sample => ({uuid: UUID.parse(sample.uuid), sample})))
            const offline = UUID.newSet<{ uuid: UUID.Bytes, sample: Sample }>(x => x.uuid)
            offline.addMany((await SampleStorage.get().list()).map(sample => ({
                uuid: UUID.parse(sample.uuid),
                sample
            })))
            for (const box of boxes) {
                const uuid = box.address.uuid
                if (online.hasKey(uuid)) {continue}
                const optSample = offline.opt(uuid)
                if (optSample.isEmpty()) {
                    const {status, error, value: sample} =
                        await Promises.tryCatch(SampleDialogs
                            .missingSampleDialog(sampleService, uuid, box.fileName.getValue()))
                    if (status === "rejected") {
                        if (Errors.isAbort(error)) {continue} else {return panic(String(error))}
                    }
                    await RuntimeNotifier.info({
                        headline: "Replaced Sample",
                        message: `${sample.name} has been replaced`
                    })
                    sampleManager.invalidate(UUID.parse(sample.uuid))
                }
            }
        }
    }
}