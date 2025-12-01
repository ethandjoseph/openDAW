export type Manual = {
    type: "page"
    label: string
    path: string
} | {
    type: "folder"
    label: string
    files: ReadonlyArray<Manual>
}

export const Manuals: ReadonlyArray<Manual> = [
    {type: "page", label: "Browser Support", path: "/manuals/browser-support"},
    {type: "page", label: "Cloud Backup", path: "/manuals/cloud-backup"},
    {type: "page", label: "Recording", path: "/manuals/recording"},
    {type: "page", label: "Keyboard Shortcuts", path: "/manuals/keyboard-shortcuts"},
    {type: "page", label: "Private File System", path: "/manuals/private-file-system"},
    {type: "page", label: "Firefox Midi", path: "/manuals/firefox-midi"},
    {type: "page", label: "Permissions", path: "/manuals/permissions"},
    {type: "page", label: "Tech Stack", path: "/manuals/tech-stack"},
    {type: "page", label: "Shadertoy", path: "/manuals/shadertoy"},
    {type: "page", label: "Dev Log", path: "/manuals/dev-log"},
    {
        type: "folder", label: "Devices", files: [{
            type: "folder", label: "MIDI FX", files: [
                {type: "page", label: "Velocity", path: "/manuals/devices/midi/velocity"}
            ]
        }]
    }
]