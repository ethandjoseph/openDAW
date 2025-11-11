import {AudioEffects, AudioUnit, GroupAudioUnit, MIDIEffects, NoteTrack, OutputAudioUnit, VolumeValue, PanValue, ValueTrack, Instruments} from "../Api"
import {ProjectImpl} from "./ProjectImpl"
import {NoteTrackImpl} from "./NoteTrackImpl"
import {ValueTrackImpl} from "./ValueTrackImpl"
import {DelayEffectImpl} from "./DelayEffectImpl"
import {PitchEffectImpl} from "./PitchEffectImpl"

export abstract class AudioUnitImpl implements AudioUnit {
    protected project: ProjectImpl
    
    #volume: VolumeValue
    #pan: PanValue
    #mute: boolean
    #solo: boolean
    #output: OutputAudioUnit | GroupAudioUnit | null
    #audioEffects: Map<string, AudioEffects[keyof AudioEffects]>
    #midiEffects: Map<string, MIDIEffects[keyof MIDIEffects]>
    #noteTracks: NoteTrackImpl[]
    #valueTracks: ValueTrackImpl[]

    constructor(project: ProjectImpl) {
        this.project = project
        this.#volume = "default"
        this.#pan = "center"
        this.#mute = false
        this.#solo = false
        this.#output = null
        this.#audioEffects = new Map()
        this.#midiEffects = new Map()
        this.#noteTracks = []
        this.#valueTracks = []
    }

    setVolume(value: VolumeValue): this {
        this.#volume = value
        return this
    }

    setPan(value: PanValue): this {
        this.#pan = value
        return this
    }

    setMute(mute: boolean): this {
        this.#mute = mute
        return this
    }

    setSolo(solo: boolean): this {
        this.#solo = solo
        return this
    }

    setOutput(output: OutputAudioUnit | GroupAudioUnit): this {
        this.#output = output
        return this
    }

    addAudioEffect<T extends keyof AudioEffects>(
        type: T,
        props?: Partial<AudioEffects[T]>
    ): AudioEffects[T] {
        let effect: AudioEffects[T]
        
        switch (type) {
            case "delay":
                effect = new DelayEffectImpl(props) as AudioEffects[T]
                break
            default:
                throw new Error(`Unknown audio effect type: ${type}`)
        }
        
        this.#audioEffects.set(type, effect)
        return effect
    }

    addMIDIEffect<T extends keyof MIDIEffects>(
        type: T,
        props?: Partial<MIDIEffects[T]>
    ): MIDIEffects[T] {
        let effect: MIDIEffects[T]
        
        switch (type) {
            case "pitch":
                effect = new PitchEffectImpl(props) as MIDIEffects[T]
                break
            default:
                throw new Error(`Unknown MIDI effect type: ${type}`)
        }
        
        this.#midiEffects.set(type, effect)
        return effect
    }

    addNoteTrack(props?: Partial<NoteTrack>): NoteTrack {
        const track = new NoteTrackImpl(this as any, props)
        this.#noteTracks.push(track)
        return track
    }

    addValueTrack<
        T extends (MIDIEffects[keyof MIDIEffects] | AudioEffects[keyof AudioEffects] | Instruments[keyof Instruments]),
        K extends keyof T
    >(target: T, parameter: K): ValueTrack {
        const track = new ValueTrackImpl(this, target, String(parameter))
        this.#valueTracks.push(track)
        return track
    }

    getVolume(): VolumeValue {
        return this.#volume
    }

    getPan(): PanValue {
        return this.#pan
    }

    isMuted(): boolean {
        return this.#mute
    }

    isSolo(): boolean {
        return this.#solo
    }

    getOutput(): OutputAudioUnit | GroupAudioUnit | null {
        return this.#output
    }

    getAudioEffects(): ReadonlyMap<string, AudioEffects[keyof AudioEffects]> {
        return this.#audioEffects
    }

    getMIDIEffects(): ReadonlyMap<string, MIDIEffects[keyof MIDIEffects]> {
        return this.#midiEffects
    }

    getNoteTracks(): ReadonlyArray<NoteTrackImpl> {
        return this.#noteTracks
    }

    getValueTracks(): ReadonlyArray<ValueTrackImpl> {
        return this.#valueTracks
    }
}
