import {
    Arrays,
    DefaultObservableValue,
    Errors,
    panic,
    Procedure,
    Progress,
    RuntimeNotifier,
    UUID
} from "@opendaw/lib-std"
import {estimateBpm} from "@opendaw/lib-dsp"
import {Files} from "@opendaw/lib-dom"
import {Promises} from "@opendaw/lib-runtime"
import {SamplePeaks} from "@opendaw/lib-fusion"
import {AudioData, Sample, SampleMetaData} from "@opendaw/studio-adapters"
import {FilePickerAcceptTypes, SampleStorage, Workers} from "../index"

export namespace SampleService {
    export type ImportArgs = {
        uuid?: UUID.Bytes,
        name: string,
        arrayBuffer: ArrayBuffer,
        progressHandler?: Progress.Handler
    }
}

export class SampleService {
    constructor(readonly audioContext: AudioContext, readonly onUpdate: Procedure<Sample>) {}

    async browseForSamples(multiple: boolean): Promise<void> {
        const {error, status, value: files} =
            await Promises.tryCatch(Files.open({...FilePickerAcceptTypes.WavFiles, multiple}))
        if (status === "rejected") {
            if (Errors.isAbort(error)) {return} else {return panic(String(error)) }
        }
        const progress = new DefaultObservableValue(0.0)
        const dialog = RuntimeNotifier.progress({
            headline: `Importing ${files.length === 1 ? "Sample" : "Samples"}...`, progress
        })
        const progressHandler = Progress.split(value => progress.setValue(value), files.length)
        const rejected: Array<string> = []
        for (const [index, file] of files.entries()) {
            const arrayBuffer = await file.arrayBuffer()
            const {
                status,
                error
            } = await Promises.tryCatch(this.importSample({
                name: file.name,
                arrayBuffer: arrayBuffer,
                progressHandler: progressHandler[index]
            }))
            if (status === "rejected") {rejected.push(String(error))}
        }
        dialog.terminate()
        if (rejected.length > 0) {
            await RuntimeNotifier.info({
                headline: "Sample Import Issues",
                message: `${rejected.join(", ")} could not be imported.`
            })
        }
    }

    async importSample({uuid, name, arrayBuffer, progressHandler = Progress.Empty}
                       : SampleService.ImportArgs): Promise<Sample> {
        console.debug(`importSample '${name}' (${arrayBuffer.byteLength >> 10}kb)`)
        console.time("UUID.sha256")
        uuid ??= await UUID.sha256(arrayBuffer) // Must run before decodeAudioData laster, because it will detach the ArrayBuffer
        console.timeEnd("UUID.sha256")
        console.time("decodeAudioData")
        const audioResult = await Promises.tryCatch(this.audioContext.decodeAudioData(arrayBuffer))
        console.timeEnd("decodeAudioData")
        if (audioResult.status === "rejected") {return Promise.reject(name)}
        const {value: audioBuffer} = audioResult
        console.debug(`Imported ${audioBuffer.duration.toFixed(1)} seconds`)
        const audioData: AudioData = {
            sampleRate: audioBuffer.sampleRate,
            numberOfFrames: audioBuffer.length,
            numberOfChannels: audioBuffer.numberOfChannels,
            frames: Arrays.create(index => audioBuffer.getChannelData(index), audioBuffer.numberOfChannels)
        }
        const shifts = SamplePeaks.findBestFit(audioData.numberOfFrames)
        const peaks = await Workers.Peak.generateAsync(
            progressHandler,
            shifts,
            audioData.frames,
            audioData.numberOfFrames,
            audioData.numberOfChannels) as ArrayBuffer
        const meta: SampleMetaData = {
            bpm: estimateBpm(audioBuffer.duration),
            name: name.substring(0, name.lastIndexOf(".")),
            duration: audioBuffer.duration,
            sample_rate: audioBuffer.sampleRate,
            origin: "import"
        }
        await SampleStorage.get().save({uuid, audio: audioData, peaks, meta})
        const sample = {uuid: UUID.toString(uuid), ...meta}
        this.onUpdate(sample)
        return sample
    }
}