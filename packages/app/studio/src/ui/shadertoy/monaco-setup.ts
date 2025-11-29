// Import only the core editor and TypeScript support (not all languages)
import * as monaco from "monaco-editor"
import "monaco-editor/esm/vs/language/typescript/monaco.contribution"
import "monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution"

// noinspection JSUnusedGlobalSymbols
self.MonacoEnvironment = {/*TODO ?*/}

// Configure TypeScript defaults

export {monaco}
export type Monaco = typeof monaco