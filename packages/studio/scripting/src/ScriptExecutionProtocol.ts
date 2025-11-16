export type ScriptExecutionContext = { sampleRate: number }

export interface ScriptExecutionProtocol {
    executeScript(script: string, context: ScriptExecutionContext): Promise<void>
}