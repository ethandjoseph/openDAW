import {DefaultObservableValue, Errors, panic, Procedure, Progress, RuntimeNotifier, UUID} from "@opendaw/lib-std"
import {Soundfont, SoundfontMetaData} from "@opendaw/studio-adapters"
import {SoundfontStorage} from "./SoundfontStorage"
import {SoundFont2} from "soundfont2"
import {Promises} from "@opendaw/lib-runtime"
import {Files} from "@opendaw/lib-dom"
import {FilePickerAcceptTypes} from "../FilePickerAcceptTypes"

export namespace SoundfontService {
    export type ImportArgs = {
        uuid?: UUID.Bytes,
        arrayBuffer: ArrayBuffer,
        progressHandler?: Progress.Handler
    }
}

export class SoundfontService {
    constructor(readonly onUpdate: Procedure<Soundfont>) {}

    async browseForSoundfont(multiple: boolean = false): Promise<void> {
        const {error, status, value: files} =
            await Promises.tryCatch(Files.open({...FilePickerAcceptTypes.SoundfontFiles, multiple}))
        if (status === "rejected") {
            if (Errors.isAbort(error)) {return} else {return panic(String(error)) }
        }
        const progress = new DefaultObservableValue(0.0)
        const dialog = RuntimeNotifier.progress({
            headline: `Importing ${files.length === 1 ? "Soundfont" : "Soundfonts"}...`, progress
        })
        const progressHandler = Progress.split(value => progress.setValue(value), files.length)
        const rejected: Array<string> = []
        for (const [index, file] of files.entries()) {
            const arrayBuffer = await file.arrayBuffer()
            const {
                status,
                error
            } = await Promises.tryCatch(this.importSoundfont({
                arrayBuffer,
                progressHandler: progressHandler[index]
            }))
            if (status === "rejected") {rejected.push(String(error))}
        }
        dialog.terminate()
        if (rejected.length > 0) {
            await RuntimeNotifier.info({
                headline: "Soundfont Import Issues",
                message: `${rejected.join(", ")} could not be imported.`
            })
        }
    }

    async importSoundfont({uuid, arrayBuffer}: SoundfontService.ImportArgs): Promise<Soundfont> {
        console.debug(`importSoundfont (${arrayBuffer.byteLength >> 10}kb)`)
        console.time("UUID.sha256")
        uuid ??= await UUID.sha256(arrayBuffer)
        console.timeEnd("UUID.sha256")
        const soundFont2 = new SoundFont2(new Uint8Array(arrayBuffer))
        const meta: SoundfontMetaData = {
            name: soundFont2.metaData.name,
            url: "file",
            license: soundFont2.metaData.copyright ?? "No license provided",
            origin: "import"
        }
        await SoundfontStorage.get().save({uuid, file: arrayBuffer, meta})
        const soundfont = {uuid: UUID.toString(uuid), ...meta}
        this.onUpdate(soundfont)
        return soundfont
    }
}