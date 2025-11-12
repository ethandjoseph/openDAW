export interface ScriptExecutionProtocol {
    execute(script: string): Promise<void>
}