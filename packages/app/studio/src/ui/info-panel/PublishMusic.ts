import {AudioOfflineRenderer, ProjectBundle, ProjectProfile, WavFile} from "@opendaw/studio-core"
import {Option, panic, Progress} from "@opendaw/lib-std"
import {Promises} from "@opendaw/lib-runtime"

export namespace PublishMusic {
    export const publishMusic = async (profile: ProjectProfile, progress: Progress.Handler): Promise<string> => {
        const [bundleProgress, ffmpegProgress, convertProgress, uploadProgress] = Progress.split(progress, 4)
        const bundleResult = await Promises.tryCatch(ProjectBundle.encode(profile.copyForUpload(), bundleProgress))
        if (bundleResult.status === "rejected") {
            return panic(bundleResult.error)
        }
        const mixdownResult = await Promises.tryCatch(AudioOfflineRenderer.start(profile.project, Option.None))
        if (mixdownResult.status === "rejected") {
            return panic(mixdownResult.error)
        }
        const {FFmpegWorker} = await Promises.guardedRetry(() =>
            import("@opendaw/studio-core/FFmpegWorker"), (_, count) => count < 10)
        const ffmpegResult = await Promises.tryCatch(FFmpegWorker.load(ffmpegProgress))
        if (ffmpegResult.status === "rejected") {
            return panic(ffmpegResult.error)
        }
        const mp3File = await ffmpegResult.value.mp3Converter()
            .convert(new Blob([WavFile.encodeFloats(mixdownResult.value)]), convertProgress)
        const formData = new FormData()
        formData.append("mixdown", new Blob([mp3File], {type: "audio/mpeg"}), "mixdown.mp3")
        formData.append("bundle", new Blob([bundleResult.value], {type: "application/zip"}), "project.odb")
        const {resolve, reject, promise} = Promise.withResolvers<string>()
        const xhr = new XMLHttpRequest()
        xhr.upload.addEventListener("progress", event => {
            console.debug(event)
            if (event.lengthComputable) {
                uploadProgress(event.loaded / event.total)
            }
        })
        xhr.addEventListener("load", () => {
            if (xhr.status === 201) {
                const response = JSON.parse(xhr.responseText)
                console.debug(response)
                resolve(response.id)
            } else {
                const error = JSON.parse(xhr.responseText)
                reject(new Error(error.error || "Upload failed"))
            }
        })
        xhr.addEventListener("error", () => reject(new Error("Network error")))
        xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")))
        xhr.open("POST", "https://api.opendaw.studio/music/upload.php")
        xhr.send(formData)
        return promise
    }
}