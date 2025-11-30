import * as monaco from "monaco-editor"
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker"

self.MonacoEnvironment = {
    getWorker: () => new editorWorker()
}

const shadertoyGlobals = [
    "iResolution", "iTime", "iTimeDelta", "iFrame", "iChannelTime",
    "iChannelResolution", "iMouse", "iChannel0", "iChannel1",
    "iChannel2", "iChannel3", "iDate", "iSampleRate", "iMidiCC"
]

const shadertoyFunctions = [
    "midiCC"
]

const glslTypes = [
    "void", "bool", "int", "uint", "float", "double",
    "vec2", "vec3", "vec4", "ivec2", "ivec3", "ivec4",
    "uvec2", "uvec3", "uvec4", "bvec2", "bvec3", "bvec4",
    "mat2", "mat3", "mat4", "mat2x2", "mat2x3", "mat2x4",
    "mat3x2", "mat3x3", "mat3x4", "mat4x2", "mat4x3", "mat4x4",
    "sampler2D", "sampler3D", "samplerCube"
]

const glslKeywords = [
    "const", "uniform", "in", "out", "inout",
    "if", "else", "for", "while", "do", "switch", "case", "default",
    "break", "continue", "return", "discard",
    "struct", "precision", "highp", "mediump", "lowp"
]

const glslBuiltins = [
    "radians", "degrees", "sin", "cos", "tan", "asin", "acos", "atan",
    "sinh", "cosh", "tanh", "asinh", "acosh", "atanh",
    "pow", "exp", "log", "exp2", "log2", "sqrt", "inversesqrt",
    "abs", "sign", "floor", "ceil", "trunc", "round", "fract",
    "mod", "min", "max", "clamp", "mix", "step", "smoothstep",
    "length", "distance", "dot", "cross", "normalize", "faceforward",
    "reflect", "refract", "matrixCompMult", "outerProduct", "transpose",
    "determinant", "inverse", "lessThan", "lessThanEqual", "greaterThan",
    "greaterThanEqual", "equal", "notEqual", "any", "all", "not",
    "texture", "textureProj", "textureLod", "textureGrad",
    "texelFetch", "dFdx", "dFdy", "fwidth"
]

const uniformDetails: Record<string, string> = {
    iResolution: "vec3 – viewport resolution (width, height, pixel aspect ratio)",
    iTime: "float – elapsed time in seconds",
    iTimeDelta: "float – time since last frame in seconds",
    iFrame: "int – frame counter",
    iChannelTime: "float[4] – playback time for each channel",
    iChannelResolution: "vec3[4] – resolution of each channel",
    iMouse: "vec4 – mouse coordinates (xy = current, zw = click)",
    iChannel0: "sampler2D – input texture 0 (audio: row 0 = waveform, row 1 = spectrum)",
    iChannel1: "sampler2D – input texture 1",
    iChannel2: "sampler2D – input texture 2",
    iChannel3: "sampler2D – input texture 3",
    iDate: "vec4 – year, month, day, time in seconds",
    iSampleRate: "float – audio sample rate",
    iMidiCC: "sampler2D – MIDI CC values (128x1 texture, use midiCC() to access)"
}

const functionDetails: Record<string, string> = {
    midiCC: "float midiCC(int cc) – returns MIDI CC value (0.0-1.0) for controller 0-127"
}

const allDetails = { ...uniformDetails, ...functionDetails }

monaco.languages.register({ id: "glsl" })

monaco.languages.setMonarchTokensProvider("glsl", {
    shadertoyGlobals,
    shadertoyFunctions,
    glslTypes,
    glslKeywords,
    glslBuiltins,
    tokenizer: {
        root: [
            [/[a-zA-Z_]\w*/, {
                cases: {
                    "@shadertoyGlobals": "variable.predefined",
                    "@shadertoyFunctions": "support.function",
                    "@glslTypes": "type",
                    "@glslKeywords": "keyword",
                    "@glslBuiltins": "support.function",
                    "@default": "identifier"
                }
            }],
            [/\/\/.*$/, "comment"],
            [/\/\*/, "comment", "@comment"],
            [/#\s*\w+/, "keyword.preprocessor"],
            [/\d+\.\d*([eE][-+]?\d+)?/, "number.float"],
            [/\d*\.\d+([eE][-+]?\d+)?/, "number.float"],
            [/\d+[eE][-+]?\d+/, "number.float"],
            [/\d+/, "number"],
            [/[{}()\[\]]/, "delimiter.bracket"],
            [/[<>](?!@)/, "delimiter.angle"],
            [/[;,.]/, "delimiter"],
            [/[+\-*/%&|^!~=<>?:]/, "operator"]
        ],
        comment: [
            [/[^/*]+/, "comment"],
            [/\*\//, "comment", "@pop"],
            [/[/*]/, "comment"]
        ]
    }
})

monaco.languages.setLanguageConfiguration("glsl", {
    comments: {
        lineComment: "//",
        blockComment: ["/*", "*/"]
    },
    brackets: [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"]
    ],
    autoClosingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: '"', close: '"' }
    ],
    surroundingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: '"', close: '"' }
    ]
})

monaco.languages.registerCompletionItemProvider("glsl", {
    provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position)
        const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
        }
        const suggestions: monaco.languages.CompletionItem[] = [
            ...shadertoyGlobals.map(name => ({
                label: name,
                kind: monaco.languages.CompletionItemKind.Variable,
                insertText: name,
                detail: uniformDetails[name],
                range
            })),
            ...shadertoyFunctions.map(name => ({
                label: name,
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: name + "($0)",
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: functionDetails[name],
                range
            })),
            ...glslBuiltins.map(name => ({
                label: name,
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: name + "($0)",
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range
            })),
            ...glslTypes.map(name => ({
                label: name,
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: name,
                range
            })),
            ...glslKeywords.map(name => ({
                label: name,
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: name,
                range
            })),
            {
                label: "mainImage",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: "void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n\t$0\n}",
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: "Shadertoy entry point",
                range
            }
        ]
        return { suggestions }
    }
})

monaco.languages.registerHoverProvider("glsl", {
    provideHover: (model, position) => {
        const word = model.getWordAtPosition(position)
        if (!word) return null
        const detail = allDetails[word.word]
        if (!detail) return null
        return {
            range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            },
            contents: [{ value: `**${word.word}**\n\n${detail}` }]
        }
    }
})

export { monaco }
export type Monaco = typeof monaco