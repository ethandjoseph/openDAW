import {EmptyExec, UUID} from "@opendaw/lib-std"
import {Promises} from "@opendaw/lib-runtime"
import {Soundfont, SoundfontMetaData} from "@opendaw/studio-adapters"
import {Workers} from "../Workers"
import {SoundFont2} from "soundfont2"

export namespace SoundfontStorage {
    export const Folder = "soundfont"

    export type New = {
        uuid: UUID.Bytes,
        file: ArrayBuffer,
        meta: SoundfontMetaData
    }

    export const saveSoundfont = async ({uuid, file, meta}: New): Promise<void> => {
        const path = `${Folder}/${UUID.toString(uuid)}`
        console.debug(`save sample '${path}'`)
        return Promise.all([
            Workers.Opfs.write(`${path}/soundfont.sf2`, new Uint8Array(file)),
            Workers.Opfs.write(`${path}/meta.json`, new TextEncoder().encode(JSON.stringify(meta)))
        ]).then(EmptyExec)
    }

    export const loadSoundfont = async (uuid: UUID.Bytes): Promise<[SoundFont2, SoundfontMetaData]> => {
        const path = `${Folder}/${UUID.toString(uuid)}`
        return Promise.all([
            Workers.Opfs.read(`${path}/soundfont.sf2`)
                .then(bytes => new SoundFont2(new Uint8Array(bytes))),
            Workers.Opfs.read(`${path}/meta.json`)
                .then(bytes => JSON.parse(new TextDecoder().decode(bytes)))
        ])
    }

    export const deleteSoundfont = async (uuid: UUID.Bytes): Promise<void> => {
        const path = `${Folder}/${UUID.toString(uuid)}`
        const uuids = await loadTrashedIds()
        uuids.push(UUID.toString(uuid))
        await saveTrashedIds(uuids)
        await Workers.Opfs.delete(`${path}`)
    }

    export const loadTrashedIds = async (): Promise<Array<UUID.String>> => {
        const {status, value} = await Promises.tryCatch(Workers.Opfs.read(`${Folder}/trash.json`))
        return status === "rejected" ? [] : JSON.parse(new TextDecoder().decode(value))
    }

    export const saveTrashedIds = async (ids: ReadonlyArray<UUID.String>): Promise<void> => {
        const trash = new TextEncoder().encode(JSON.stringify(ids))
        await Workers.Opfs.write(`${Folder}/trash.json`, trash)
    }

    export const listSoundfonts = async (): Promise<ReadonlyArray<Soundfont>> => {
        return Workers.Opfs.list(Folder)
            .then(files => Promise.all(files.filter(file => file.kind === "directory")
                .map(async ({name}) => {
                    const array = await Workers.Opfs.read(`${Folder}/${name}/meta.json`)
                    return ({uuid: name as UUID.String, ...(JSON.parse(new TextDecoder().decode(array)) as SoundfontMetaData)})
                })), () => [])
    }
}