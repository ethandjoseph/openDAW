import * as ts from "typescript"
import * as fs from "fs"
import * as path from "path"

const rootDir = path.resolve(__dirname, "..")
const inputFiles = [
    "src/script/Api.ts",
    "../../lib/dsp/src/chords.ts",
    "../../lib/dsp/src/ppqn.ts",
].map(f => path.join(rootDir, f))

const program = ts.createProgram(inputFiles, {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    declaration: true,
    emitDeclarationOnly: true,
    skipLibCheck: true,
})

const decls: string[] = []

program.emit(undefined, (fileName, data) => {
    if (fileName.endsWith(".d.ts")) decls.push(data)
})

const cleanup = (src: string) =>
    src
        .replace(/\bexport\s+/g, "")
        .replace(/import[^;]+;/g, "")
        .replace(/import\([^)]+\)\./g, "")
        .replace(/export\s*\{[^}]+\}[^;]*;/g, "")
        .replace(/^\s*[\r\n]+/gm, "") // remove blank lines
        .trim()

const declarations =
    decls.map(cleanup).filter(Boolean).join("\n") +
    "\n\ndeclare const openDAW: Api;\n"

fs.writeFileSync(path.join(rootDir, "src/script/Declarations.d.ts"), declarations)
console.log("✓ Generated declarations")
