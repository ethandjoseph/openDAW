import * as ts from "typescript"
import * as fs from "fs"
import * as path from "path"

const rootDir = path.resolve(__dirname, "..")
const apiFilePath = path.join(rootDir, "src/script/Api.ts")
const ppqnFilePath = path.join(rootDir, "../../lib/dsp/src/ppqn.ts")

// Create a program with both files
const program = ts.createProgram([apiFilePath, ppqnFilePath], {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    declaration: true,
    emitDeclarationOnly: true,
    skipLibCheck: true,
})

let ppqnDeclarations = ""
let apiDeclarations = ""

// Emit declarations
program.emit(undefined, (fileName, data) => {
    if (fileName.endsWith("ppqn.d.ts")) {
        ppqnDeclarations = data
    } else if (fileName.endsWith("Api.d.ts")) {
        apiDeclarations = data
    }
})

console.log("Generated ppqn declarations")
console.log("Generated Api declarations")

// Combine and clean
let declarations = ppqnDeclarations
    .replace(/export /g, "")
    .replace(/import[^;]+;/g, "")
    .replace(/import\([^)]+\)\./g, "") // Remove import("...").Type references

declarations += "\n" + apiDeclarations
    .replace(/export /g, "")
    .replace(/import[^;]+;/g, "")
    .replace(/export \{[^}]+\}[^;]*;/g, "")

declarations += "\n\ndeclare const openDAW: Api;\n"

const outputPath = path.join(rootDir, "src/script/Declarations.d.ts")
fs.writeFileSync(outputPath, declarations)

console.log("✓ Generated declarations")