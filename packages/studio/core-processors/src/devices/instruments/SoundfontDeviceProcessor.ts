import {int, isDefined, Option, Terminable, UUID} from "@opendaw/lib-std"
import {Event} from "@opendaw/lib-dsp"
import {SoundfontDeviceBoxAdapter} from "@opendaw/studio-adapters"
import type {PresetZone, SoundFont2} from "soundfont2"
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

        context.engineToClient.fetchSoundfont(UUID.Lowest)
            .then(soundfont => {
                console.debug("PRESETS")
                console.debug(soundfont.presets.map(x => x.header.name).join(", "))
                this.#soundFont = Option.wrap(soundfont)
            })
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
            const ranIndex = Math.floor(Math.random() * soundfont.presets.length)
            const preset = soundfont.presets[ranIndex]
            if (isDefined(preset)) {
                console.debug("PRESET", preset.header.name, ranIndex)
                let voiceCount = 0
                for (const zone of preset.zones) {
                    if (this.#isZoneMatching(event.pitch, event.velocity, zone)) {
                        this.#voices.push(new SoundfontVoice(event, zone, soundfont))
                        voiceCount++
                    }
                }
                console.debug(`Started ${voiceCount} voices for note ${event.pitch}`)
            }
        } else if (NoteLifecycleEvent.isStop(event)) {
            this.#voices.forEach(voice => voice.event.id === event.id && voice.release())
        }
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
        if (keyRange) {
            if (pitch < (keyRange.lo ?? 0) || pitch > (keyRange.hi ?? 127)) {
                return false
            }
        }
        const velRange = zone.generators[GeneratorType.VelRange]?.range
        if (velRange) {
            if (velocity < (velRange.lo ?? 0) || velocity > (velRange.hi ?? 127)) {
                return false
            }
        }
        return true
    }
}