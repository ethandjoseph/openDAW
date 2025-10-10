import {
    Arrays,
    DefaultObservableValue,
    Errors,
    Option,
    panic,
    Procedure,
    Progress,
    RuntimeNotifier,
    UUID
} from "@opendaw/lib-std"
import {Files} from "@opendaw/lib-dom"
import {Promises} from "@opendaw/lib-runtime"
import {Soundfont, SoundfontMetaData} from "@opendaw/studio-adapters"
import {SoundFont2} from "soundfont2"
import {SoundfontStorage} from "./SoundfontStorage"
import {FilePickerAcceptTypes} from "../FilePickerAcceptTypes"
import {OpenSoundfontAPI} from "./OpenSoundfontAPI"

export namespace SoundfontService {
    export type ImportArgs = {
        uuid?: UUID.Bytes,
        arrayBuffer: ArrayBuffer,
        progressHandler?: Progress.Handler
    }
}

export class SoundfontService {
    #local: Option<Array<Soundfont>> = Option.None
    #remote: Option<ReadonlyArray<Soundfont>> = Option.None

    constructor(readonly onUpdate: Procedure<Soundfont>) {
        Promise.all([
            SoundfontStorage.get().list(),
            OpenSoundfontAPI.get().all()
        ]).then(([local, remote]) => {
            this.#local = Option.wrap(Arrays.subtract(local, remote, (a, b) => a.uuid === b.uuid))
            this.#remote = Option.wrap(remote)
        })
    }

    get local(): Option<ReadonlyArray<Soundfont>> {return this.#local}
    get remote(): Option<ReadonlyArray<Soundfont>> {return this.#remote}

    async browseForSoundfont(multiple: boolean = false): Promise<ReadonlyArray<Soundfont>> {
        const {error, status, value: files} =
            await Promises.tryCatch(Files.open({...FilePickerAcceptTypes.SoundfontFiles, multiple}))
        if (status === "rejected") {
            if (Errors.isAbort(error)) {return []} else {return panic(String(error)) }
        }
        const progress = new DefaultObservableValue(0.0)
        const dialog = RuntimeNotifier.progress({
            headline: `Importing ${files.length === 1 ? "Soundfont" : "Soundfonts"}...`, progress
        })
        const progressHandler = Progress.split(value => progress.setValue(value), files.length)
        const soundfonts: Array<Soundfont> = []
        const rejected: Array<string> = []
        for (const [index, file] of files.entries()) {
            const arrayBuffer = await file.arrayBuffer()
            const {status, value, error} = await Promises.tryCatch(this.importSoundfont({
                arrayBuffer,
                progressHandler: progressHandler[index]
            }))
            if (status === "rejected") {rejected.push(String(error))} else {soundfonts.push(value)}
        }
        dialog.terminate()
        if (rejected.length > 0) {
            await RuntimeNotifier.info({
                headline: "Soundfont Import Issues",
                message: `${rejected.join(", ")} could not be imported.`
            })
        }
        return soundfonts
    }

    async importSoundfont({uuid, arrayBuffer}: SoundfontService.ImportArgs): Promise<Soundfont> {
        if (this.#local.isEmpty()) {
            return panic("Local soundfont storage has not been read.")
        }
        if (arrayBuffer.byteLength > (1 << 24)) {
            await RuntimeNotifier.approve({
                headline: "Soundfont Import",
                message: `The soundfont you are trying to import is ${(arrayBuffer.byteLength >> 20)}mb. This may cause memory issues. Do you want to continue?`,
                approveText: "Import",
                cancelText: "Cancel"
            })
        }
        console.debug(`importSoundfont (${arrayBuffer.byteLength >> 10}kb)`)
        console.time("UUID.sha256")
        uuid ??= await UUID.sha256(arrayBuffer)
        console.timeEnd("UUID.sha256")
        const soundFont2 = new SoundFont2(new Uint8Array(arrayBuffer))
        const meta: SoundfontMetaData = {
            name: soundFont2.metaData.name,
            url: "unknown",
            license: soundFont2.metaData.copyright ?? "No license provided",
            origin: "import"
        }
        await SoundfontStorage.get().save({uuid, file: arrayBuffer, meta})
        const soundfont = {uuid: UUID.toString(uuid), ...meta}
        this.onUpdate(soundfont)
        const list = this.#local.unwrap()
        if (!list.some(other => other.uuid === soundfont.uuid)) {
            list.push(soundfont)
        }
        return soundfont
    }
}