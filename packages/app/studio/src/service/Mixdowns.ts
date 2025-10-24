import {AudioOfflineRenderer, ProjectMeta, ProjectProfile, WavFile} from "@opendaw/studio-core"
import {Errors, Option, panic, RuntimeNotifier} from "@opendaw/lib-std"
import {Promises} from "@opendaw/lib-runtime"
import {Files} from "@opendaw/lib-dom"
import {ExportStemsConfiguration} from "@opendaw/studio-adapters"

export namespace Mixdowns {
    export const exportMixdown = async ({project, meta}: ProjectProfile): Promise<void> => {
        const buffer = await AudioOfflineRenderer.start(project, Option.None)
        await saveWavFile(buffer, meta)
    }

    export const exportStems = async ({project, meta}: ProjectProfile,
                                      config: ExportStemsConfiguration): Promise<void> => {
        const buffer = await AudioOfflineRenderer.start(project, Option.wrap(config))
        await saveZipFile(buffer, meta, Object.values(config).map(({fileName}) => fileName))
    }

    const saveWavFile = async (buffer: AudioBuffer, meta: ProjectMeta) => {
        const approved = await RuntimeNotifier.approve({
            headline: "Save Wav-File",
            message: "",
            approveText: "Save"
        })
        if (!approved) {return}
        const wavFile = WavFile.encodeFloats(buffer)
        const suggestedName = `${meta.name}.wav`
        const saveResult = await Promises.tryCatch(Files.save(wavFile, {suggestedName}))
        if (saveResult.status === "rejected" && !Errors.isAbort(saveResult.error)) {
            panic(String(saveResult.error))
        }
    }

    const saveZipFile = async (buffer: AudioBuffer, meta: ProjectMeta, trackNames: ReadonlyArray<string>) => {
        const {default: JSZip} = await import("jszip")
        const dialog = RuntimeNotifier.progress({headline: "Creating Zip File..."})
        const numStems = buffer.numberOfChannels >> 1
        const zip = new JSZip()
        for (let stemIndex = 0; stemIndex < numStems; stemIndex++) {
            const l = buffer.getChannelData(stemIndex * 2)
            const r = buffer.getChannelData(stemIndex * 2 + 1)
            const file = WavFile.encodeFloats({
                channels: [l, r],
                sampleRate: buffer.sampleRate,
                numFrames: buffer.length
            })
            zip.file(`${trackNames[stemIndex]}.wav`, file, {binary: true})
        }
        const {status, value: arrayBuffer, error} = await Promises.tryCatch(zip.generateAsync({
            type: "arraybuffer",
            compression: "DEFLATE",
            compressionOptions: {level: 6}
        }))
        dialog.terminate()
        if (status === "rejected") {
            await RuntimeNotifier.info({
                headline: "Error",
                message: `Could not create zip file: ${String(error)}`
            })
            return
        }
        const approved = await RuntimeNotifier.approve({
            headline: "Save Zip",
            message: `Size: ${arrayBuffer.byteLength >> 20}M`,
            approveText: "Save"
        })
        if (!approved) {return}
        const saveResult = await Promises.tryCatch(Files.save(arrayBuffer, {suggestedName: `${meta.name}.zip`}))
        if (saveResult.status === "rejected" && !Errors.isAbort(saveResult.error)) {
            panic(String(saveResult.error))
        }
    }
}