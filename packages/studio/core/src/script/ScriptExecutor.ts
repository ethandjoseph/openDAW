import {Communicator, Messenger} from "@opendaw/lib-runtime"
import {Api, InstrumentMap} from "./Api"
import {panic} from "@opendaw/lib-std"
import {ProjectSkeleton} from "@opendaw/studio-adapters"

export const install = (messenger: Messenger) =>
    Communicator.executor(messenger.channel("script-executor"), new class implements Api {
        readonly #skeleton: ProjectSkeleton

        constructor() {
            this.#skeleton = ProjectSkeleton.empty({createOutputCompressor: true, createDefaultUser: true})
        }

        createInstrument<I extends keyof InstrumentMap>(_instrument: I): InstrumentMap[I] {
            return panic("Not implemented")
        }

        create(): void {
            return panic("Not implemented")
        }
    })