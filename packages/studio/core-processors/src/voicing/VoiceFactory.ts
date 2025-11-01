import {Voice} from "./Voice"

export interface VoiceFactory {
    create(): Voice
}