import {Arrays, Option, panic, Procedure, RuntimeNotifier, UUID} from "@opendaw/lib-std"
import {Soundfont, SoundfontMetaData} from "@opendaw/studio-adapters"
import {SoundFont2} from "soundfont2"
import {SoundfontStorage} from "./SoundfontStorage"
import {FilePickerAcceptTypes} from "../FilePickerAcceptTypes"
import {OpenSoundfontAPI} from "./OpenSoundfontAPI"
import {AssetService} from "../AssetService"

export class SoundfontService extends AssetService<Soundfont> {
    protected readonly namePlural: string = "Soundfonts"
    protected readonly nameSingular: string = "Soundfont"

    #local: Option<Array<Soundfont>> = Option.None
    #remote: Option<ReadonlyArray<Soundfont>> = Option.None

    constructor(onUpdate: Procedure<Soundfont>) {
        super(onUpdate)

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

    async browse(multiple: boolean = false): Promise<ReadonlyArray<Soundfont>> {
        return this.browseFiles(multiple, FilePickerAcceptTypes.SoundfontFiles)
    }

    async importFile({uuid, arrayBuffer}: AssetService.ImportArgs): Promise<Soundfont> {
        if (this.#local.isEmpty()) {
            return panic("Local soundfont storage has not been read.")
        }
        if (arrayBuffer.byteLength > (1 << 24)) {
            await RuntimeNotifier.approve({
                headline: "Soundfont Import",
                message: `The soundfont you are trying to import is ${(arrayBuffer.byteLength >> 20)}mb. This may cause memory issues. Do you really want to continue?`,
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
        const list = this.#local.unwrap()
        if (!list.some(other => other.uuid === soundfont.uuid)) {
            list.push(soundfont)
        }
        this.onUpdate(soundfont)
        return soundfont
    }
}