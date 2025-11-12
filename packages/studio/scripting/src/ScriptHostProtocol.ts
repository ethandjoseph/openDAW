export interface ScriptHostProtocol {
    openProject(buffer: ArrayBufferLike, name?: string): void
}