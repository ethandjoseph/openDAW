import {Voice} from "./Voice"

export interface VoiceFactory<V extends Voice> {
    create(): V
}