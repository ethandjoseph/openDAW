import {Arrays, isUndefined, Procedure, Progress, UUID} from "@opendaw/lib-std"
import {estimateBpm} from "@opendaw/lib-dsp"
import {Promises} from "@opendaw/lib-runtime"
import {SamplePeaks} from "@opendaw/lib-fusion"
import {AudioData, Sample, SampleMetaData} from "@opendaw/studio-adapters"
import {FilePickerAcceptTypes, SampleStorage, Workers} from "../index"
import {AssetService} from "../AssetService"

export class SampleService extends AssetService<Sample> {
    protected readonly namePlural: string = "Samples"
    protected readonly nameSingular: string = "Sample"

    constructor(readonly audioContext: AudioContext, onUpdate: Procedure<Sample>) {
        super(onUpdate)
    }

    async browse(multiple: boolean): Promise<ReadonlyArray<Sample>> {
        return this.browseFiles(multiple, FilePickerAcceptTypes.WavFiles)
    }

    async importFile({uuid, name, arrayBuffer, progressHandler = Progress.Empty}
                     : AssetService.ImportArgs): Promise<Sample> {
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
            name: isUndefined(name) ? "Unnnamed" : name.substring(0, name.lastIndexOf(".")),
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