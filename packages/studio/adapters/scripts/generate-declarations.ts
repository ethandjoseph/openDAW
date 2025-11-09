import * as ts from "typescript"
import * as fs from "fs"
import * as path from "path"

const rootDir = path.resolve(__dirname, "..")
const apiFilePath = path.join(rootDir, "src/script/Api.ts")

const sourceFile = ts.createSourceFile(
    apiFilePath,
    fs.readFileSync(apiFilePath, "utf-8"),
    ts.ScriptTarget.Latest,
    true
)

let declarations = ""
const reexports = new Map<string, string>()

// Find imports in Api.ts
ts.forEachChild(sourceFile, node => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const modulePath = node.moduleSpecifier.text
        const importClause = node.importClause

        if (importClause?.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
            ts.forEachChild(importClause.namedBindings, el => {
                if (ts.isImportSpecifier(el)) {
                    reexports.set(el.name.text, modulePath)
                }
            })
        }
    }
})

const printer = ts.createPrinter()

// Resolve imports
for (const [name, modulePath] of Array.from(reexports)) {
    console.log(`\nResolving ${name} from ${modulePath}...`)

    if (modulePath === "@opendaw/lib-dsp") {
        // Load the ppqn.ts file directly
        const ppqnFilePath = path.join(rootDir, "../../lib/dsp/src/ppqn.ts")

        console.log("Loading:", ppqnFilePath)

        if (fs.existsSync(ppqnFilePath)) {
            const sourceCode = fs.readFileSync(ppqnFilePath, "utf-8")
            const ppqnFile = ts.createSourceFile(ppqnFilePath, sourceCode, ts.ScriptTarget.Latest, true)

            console.log("Searching for", name, "in ppqn.ts")

            ts.forEachChild(ppqnFile, node => {
                if (ts.isVariableStatement(node)) {
                    const decl = node.declarationList.declarations[0]
                    if (ts.isIdentifier(decl.name) && decl.name.text === name) {
                        console.log("FOUND variable:", name)
                        const text = printer.printNode(ts.EmitHint.Unspecified, node, ppqnFile)
                        declarations += text.replace(/export /, "declare ") + "\n\n"
                    }
                }

                if (ts.isTypeAliasDeclaration(node) && node.name.text === name) {
                    console.log("FOUND type:", name)
                    const text = printer.printNode(ts.EmitHint.Unspecified, node, ppqnFile)
                    declarations += text.replace(/export /, "") + "\n\n"
                }
            })
        }
    }
}

// Add Api.ts declarations
ts.forEachChild(sourceFile, node => {
    if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
        node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        const text = printer.printNode(ts.EmitHint.Unspecified, node, sourceFile)
        declarations += text.replace(/export /, "") + "\n\n"
    }
})

declarations += "\ndeclare const openDAW: Api;\n"

const outputPath = path.join(rootDir, "src/script/Declarations.d.ts")
fs.writeFileSync(outputPath, declarations)

console.log("\n✓ Generated declarations")