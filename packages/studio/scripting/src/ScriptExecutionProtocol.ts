export type ScriptExecutionContext = { sampleRate: number }

export interface ScriptExecutionProtocol {
    execute(script: string, context: ScriptExecutionContext): Promise<void>
}