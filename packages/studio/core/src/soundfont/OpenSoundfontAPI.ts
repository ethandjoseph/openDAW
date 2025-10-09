import {asDefined, Lazy, Procedure, unitValue, UUID} from "@opendaw/lib-std"
import {Soundfont, SoundfontMetaData} from "@opendaw/studio-adapters"

export class OpenSoundfontAPI {
    static readonly ApiRoot = "https://api.opendaw.studio/soundfont" // TODO Not yet available
    static readonly FileRoot = "https://assets.opendaw.studio/soundfont"

    @Lazy
    static get(): OpenSoundfontAPI {return new OpenSoundfontAPI()}

    static API: ReadonlyArray<Soundfont> = [{
        "uuid": "924b4624-aa55-448b-9991-b44c88157315",
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

    async load(uuid: UUID.Bytes, _progress: Procedure<unitValue>): Promise<[ArrayBuffer, SoundfontMetaData]> {
        return this.get(uuid).then(async soundfont => {
            const url = `${OpenSoundfontAPI.FileRoot}/${soundfont.uuid}`
            return fetch(url).then(response => response.arrayBuffer()).then(buffer => [buffer, soundfont])
        })
    }

    allowsUpload(): boolean {return false}
}