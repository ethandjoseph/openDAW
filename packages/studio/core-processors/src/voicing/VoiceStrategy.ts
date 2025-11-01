import {byte, unitValue} from "@opendaw/lib-std"

interface VoiceStrategy {
    noteStart(note: byte, frequency: number, velocity: unitValue): void
    noteStop(note: byte, frequency: number): void
    clear(): void
}