import {asDefined, Lazy, Procedure, unitValue, UUID} from "@opendaw/lib-std"
import {Soundfont, SoundfontMetaData} from "@opendaw/studio-adapters"
import {OpenDAWHeaders} from "../OpenDAWHeaders"

export class OpenSoundfontAPI {
    static readonly ApiRoot = "https://api.opendaw.studio/soundfont" // TODO Not yet available
    static readonly FileRoot = "https://assets.opendaw.studio/soundfonts"

    @Lazy
    static get(): OpenSoundfontAPI {return new OpenSoundfontAPI()}

    static API: ReadonlyArray<Soundfont> = [{
        "uuid": "d9f51577-2096-4671-9067-27ca2e12b329",
        "name": "Upright Piano KW",
        "license": "CC0 1.0 Universal",
        "url": "https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html",
        "origin": "openDAW"
    }]

    private constructor() {}

    async all(): Promise<ReadonlyArray<Soundfont>> {return OpenSoundfontAPI.API}

    async get(uuid: UUID.Bytes): Promise<Soundfont> {
        const uuidAsString = UUID.toString(uuid)
        return asDefined(OpenSoundfontAPI.API.find(({uuid}) => uuid === uuidAsString), "Could not find Soundfont")
    }

    async load(uuid: UUID.Bytes, progress: Procedure<unitValue>): Promise<[ArrayBuffer, SoundfontMetaData]> {
        return this.get(uuid).then(async soundfont => {
            const url = `${OpenSoundfontAPI.FileRoot}/${soundfont.uuid}`
            return fetch(url, OpenDAWHeaders)
                .then(response => {
                    const total = parseInt(response.headers.get("Content-Length") ?? "0")
                    let loaded = 0
                    return new Promise<ArrayBuffer>((resolve, reject) => {
                        const reader = asDefined(response.body, "No body in response").getReader()
                        const chunks: Array<Uint8Array> = []
                        const nextChunk = ({done, value}: ReadableStreamReadResult<Uint8Array>) => {
                            if (done) {
                                resolve(new Blob(chunks as Array<BlobPart>).arrayBuffer())
                            } else {
                                chunks.push(value)
                                loaded += value.length
                                progress(loaded / total)
                                reader.read().then(nextChunk, reject)
                            }
                        }
                        reader.read().then(nextChunk, reject)
                    })
                })
                .then(buffer => [buffer, soundfont])
        })
    }

    allowsUpload(): boolean {return false}
}