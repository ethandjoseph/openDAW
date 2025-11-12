import {Communicator, Messenger} from "@opendaw/lib-runtime"

import {ScriptExecutionProtocol} from "./ScriptExecutionProtocol"
import {ScriptExecutor} from "./ScriptExecutor"
import {ScriptHostProtocol} from "./ScriptHostProtocol"

const messenger: Messenger = Messenger.for(self)

const hostProtocol = Communicator.sender<ScriptHostProtocol>(messenger.channel("scripting-host"),
    dispatcher => new class implements ScriptHostProtocol {
        openProject(buffer: ArrayBufferLike, name?: string): void {
            dispatcher.dispatchAndForget(this.openProject, buffer, name)
        }
    })

Communicator.executor(messenger.channel("scripting-execution"), new class implements ScriptExecutionProtocol {
    readonly #scriptExecutor = new ScriptExecutor(hostProtocol)

    // TODO We might return information about the script execution, e.g. warnings
    execute(script: string): Promise<void> {return this.#scriptExecutor.run(script)}
})