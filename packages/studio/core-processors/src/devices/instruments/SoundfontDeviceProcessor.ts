import {int, isDefined, Option, Terminable, UUID} from "@opendaw/lib-std"
import {Event} from "@opendaw/lib-dsp"
import {SoundfontDeviceBoxAdapter} from "@opendaw/studio-adapters"
import type {Generator, PresetZone, SoundFont2, ZoneMap} from "soundfont2"
import {AudioProcessor} from "../../AudioProcessor"
import {InstrumentDeviceProcessor} from "../../InstrumentDeviceProcessor"
import {NoteEventSource, NoteEventTarget, NoteLifecycleEvent} from "../../NoteEventSource"
import {NoteEventInstrument} from "../../NoteEventInstrument"
import {AudioBuffer} from "../../AudioBuffer"
import {PeakBroadcaster} from "../../PeakBroadcaster"
import {EngineContext} from "../../EngineContext"
import {DeviceProcessor} from "../../DeviceProcessor"
import {Block, Processor} from "../../processing"
import {SoundfontVoice} from "./Soundfont/SoundfontVoice"
import {GeneratorType} from "./Soundfont/GeneratorType"

export class SoundfontDeviceProcessor extends AudioProcessor implements InstrumentDeviceProcessor, NoteEventTarget {
    readonly #adapter: SoundfontDeviceBoxAdapter
    readonly #voices: Array<SoundfontVoice>
    readonly #noteEventInstrument: NoteEventInstrument
    readonly #audioOutput: AudioBuffer
    readonly #peakBroadcaster: PeakBroadcaster

    #soundFont: Option<SoundFont2> = Option.None

    constructor(context: EngineContext, adapter: SoundfontDeviceBoxAdapter) {
        super(context)

        this.#adapter = adapter
        this.#voices = []
        this.#noteEventInstrument = new NoteEventInstrument(this, context.broadcaster, adapter.audioUnitBoxAdapter().address)
        this.#audioOutput = new AudioBuffer()
        this.#peakBroadcaster = this.own(new PeakBroadcaster(context.broadcaster, adapter.address))

        this.own(context.registerProcessor(this))

        // TODO Introduce system to reuse soundfont and not reload it every time
        context.engineToClient.fetchSoundfont(UUID.Lowest)
            .then(soundfont => this.#soundFont = Option.wrap(soundfont))
    }

    introduceBlock(block: Block): void {this.#noteEventInstrument.introduceBlock(block)}
    setNoteEventSource(source: NoteEventSource): Terminable {return this.#noteEventInstrument.setNoteEventSource(source)}

    get noteEventTarget(): Option<NoteEventTarget & DeviceProcessor> {return Option.wrap(this)}
    get incoming(): Processor {return this}
    get outgoing(): Processor {return this}
    get uuid(): UUID.Bytes {return this.#adapter.uuid}
    get audioOutput(): AudioBuffer {return this.#audioOutput}
    get adapter(): SoundfontDeviceBoxAdapter {return this.#adapter}

    reset(): void {
        this.#noteEventInstrument.clear()
        this.#peakBroadcaster.clear()
        this.#voices.length = 0
        this.#audioOutput.clear()
        this.eventInput.clear()
    }

    handleEvent(event: Event): void {
        if (this.#soundFont.isEmpty()) {return}
        const soundfont = this.#soundFont.unwrap()
        if (NoteLifecycleEvent.isStart(event)) {
            const ranIndex = 0//Math.floor(randomIndex)
            const preset = soundfont.presets[ranIndex]
            if (isDefined(preset)) {
                let voiceCount = 0
                for (const presetZone of preset.zones) {
                    if (this.#isZoneMatching(event.pitch, event.velocity, presetZone)) {
                        const instrumentZones = presetZone.instrument.zones
                        for (let i = 0; i < instrumentZones.length; i++) {
                            const instZone = instrumentZones[i]
                            if (this.#isInstrumentZoneMatching(event.pitch, event.velocity, instZone)) {
                                this.#voices.push(new SoundfontVoice(event, presetZone, instZone, soundfont))
                                voiceCount++
                            }
                        }
                    }
                }
                console.debug(`Started ${voiceCount} voices for note ${event.pitch} in preset#${ranIndex}: ${preset.header.name}`)
            }
        } else if (NoteLifecycleEvent.isStop(event)) {
            this.#voices.forEach(voice => voice.event.id === event.id && voice.release())
        }
    }

    #isInstrumentZoneMatching(pitch: number, velocity: number, zone: { generators: ZoneMap<Generator> }): boolean {
        const keyRange = zone.generators[GeneratorType.KeyRange]?.range
        if (keyRange) {
            if (pitch < keyRange.lo || pitch > keyRange.hi) {
                return false
            }
        }
        const velRange = zone.generators[GeneratorType.VelRange]?.range
        if (velRange) {
            if (velocity < velRange.lo || velocity > velRange.hi) {
                return false
            }
        }
        return true
    }

    processAudio(_block: Block, fromIndex: int, toIndex: int): void {
        this.#audioOutput.clear(fromIndex, toIndex)
        for (let i = this.#voices.length - 1; i >= 0; i--) {
            if (this.#voices[i].processAdd(this.#audioOutput, fromIndex, toIndex)) {
                this.#voices.splice(i, 1)
            }
        }
    }

    finishProcess(): void {
        this.#audioOutput.assertSanity()
        this.#peakBroadcaster.process(this.#audioOutput.getChannel(0), this.#audioOutput.getChannel(1))
    }

    toString(): string {return `{SoundfontDevice}`}

    #isZoneMatching(pitch: number, velocity: number, zone: PresetZone): boolean {
        const keyRange = zone.generators[GeneratorType.KeyRange]?.range
        if (isDefined(keyRange) && (pitch < keyRange.lo || pitch > keyRange.hi)) {
            return false
        }
        const velRange = zone.generators[GeneratorType.VelRange]?.range
        if (isDefined(velRange) && (velocity < velRange.lo || velocity > velRange.hi)) {
            return false
        }
        return true
    }
}