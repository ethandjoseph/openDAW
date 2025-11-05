import {asEnumValue, int, Option, panic, Terminable, UUID} from "@opendaw/lib-std"
import {AudioBuffer, ClassicWaveform, dbToGain, Event, midiToHz, NoteEvent, PPQN, ppqn} from "@opendaw/lib-dsp"
import {VaporisateurDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {EngineContext} from "../../EngineContext"
import {AudioProcessor} from "../../AudioProcessor"
import {Block, Processor} from "../../processing"
import {PeakBroadcaster} from "../../PeakBroadcaster"
import {AutomatableParameter} from "../../AutomatableParameter"
import {NoteEventSource, NoteEventTarget, NoteLifecycleEvent} from "../../NoteEventSource"
import {NoteEventInstrument} from "../../NoteEventInstrument"
import {DeviceProcessor} from "../../DeviceProcessor"
import {InstrumentDeviceProcessor} from "../../InstrumentDeviceProcessor"
import {Voice} from "../../voicing/Voice"
import {Voicing} from "../../voicing/Voicing"
import {PolyphonicStrategy} from "../../voicing/PolyphonicStrategy"
import {VoicingHost} from "../../voicing/VoicingHost"
import {VoicingMode} from "@opendaw/studio-enums"
import {MonophonicStrategy} from "../../voicing/MonophonicStrategy"
import {VoiceUnison} from "../../voicing/VoiceUnison"
import {VaporisateurVoice} from "./VaporisateurVoice"

export class VaporisateurDeviceProcessor extends AudioProcessor implements InstrumentDeviceProcessor, VoicingHost, NoteEventTarget {
    readonly #adapter: VaporisateurDeviceBoxAdapter

    readonly #voicing: Voicing
    readonly #noteEventInstrument: NoteEventInstrument
    readonly #audioOutput: AudioBuffer
    readonly #peakBroadcaster: PeakBroadcaster
    readonly #parameterVolume: AutomatableParameter<number>
    readonly #parameterOctave: AutomatableParameter<number>
    readonly #parameterTune: AutomatableParameter<number>
    readonly #parameterAttack: AutomatableParameter<number>
    readonly #parameterDecay: AutomatableParameter<number>
    readonly #parameterSustain: AutomatableParameter<number>
    readonly #parameterRelease: AutomatableParameter<number>
    readonly #parameterWaveform: AutomatableParameter<number>
    readonly #parameterCutoff: AutomatableParameter<number>
    readonly #parameterResonance: AutomatableParameter<number>
    readonly #parameterFilterEnvelope: AutomatableParameter<number>
    readonly #parameterFilterOrder: AutomatableParameter<int>
    readonly #parameterFilterKeyboard: AutomatableParameter<number>
    readonly #parameterGlideTime: AutomatableParameter<number>
    readonly #parameterVoicingMode: AutomatableParameter<VoicingMode>
    readonly #parameterUnisonCount: AutomatableParameter<int>
    readonly #parameterUnisonDetune: AutomatableParameter<number>
    readonly #parameterUnisonStereo: AutomatableParameter<number>
    readonly #parameterLfoShape: AutomatableParameter<ClassicWaveform>
    readonly #parameterLfoRate: AutomatableParameter<number>
    readonly #parameterLfoTargetTune: AutomatableParameter<number>
    readonly #parameterLfoTargetCutoff: AutomatableParameter<number>
    readonly #parameterLfoTargetVolume: AutomatableParameter<number>

    gain: number = 1.0
    env_attack: number = 1.0
    env_decay: number = 1.0
    env_sustain: number = 1.0
    env_release: number = 1.0
    osc_waveform: ClassicWaveform = ClassicWaveform.sine
    flt_cutoff: number = 1.0
    flt_resonance: number = Math.SQRT1_2
    flt_env_amount: number = 0.0
    flt_order: int = 1
    #frequencyMultiplier: number = 1.0
    #glideTime: number = 0.0

    constructor(context: EngineContext, adapter: VaporisateurDeviceBoxAdapter) {
        super(context)

        this.#adapter = adapter

        this.#voicing = new Voicing()
        this.#noteEventInstrument = new NoteEventInstrument(this, context.broadcaster, adapter.audioUnitBoxAdapter().address)
        this.#audioOutput = new AudioBuffer()
        this.#peakBroadcaster = this.own(new PeakBroadcaster(context.broadcaster, adapter.address))

        const {namedParameter} = this.#adapter
        this.#parameterVolume = this.own(this.bindParameter(namedParameter.volume))
        this.#parameterOctave = this.own(this.bindParameter(namedParameter.octave))
        this.#parameterTune = this.own(this.bindParameter(namedParameter.tune))
        this.#parameterAttack = this.own(this.bindParameter(namedParameter.attack))
        this.#parameterDecay = this.own(this.bindParameter(namedParameter.decay))
        this.#parameterSustain = this.own(this.bindParameter(namedParameter.sustain))
        this.#parameterRelease = this.own(this.bindParameter(namedParameter.release))
        this.#parameterWaveform = this.own(this.bindParameter(namedParameter.waveform))
        this.#parameterCutoff = this.own(this.bindParameter(namedParameter.cutoff))
        this.#parameterResonance = this.own(this.bindParameter(namedParameter.resonance))
        this.#parameterFilterEnvelope = this.own(this.bindParameter(namedParameter.filterEnvelope))
        this.#parameterFilterOrder = this.own(this.bindParameter(namedParameter.filterOrder))
        this.#parameterFilterKeyboard = this.own(this.bindParameter(namedParameter.filterKeyboard))
        this.#parameterGlideTime = this.own(this.bindParameter(namedParameter.glideTime))
        this.#parameterVoicingMode = this.own(this.bindParameter(namedParameter.voicingMode))
        this.#parameterUnisonCount = this.own(this.bindParameter(namedParameter.unisonCount))
        this.#parameterUnisonDetune = this.own(this.bindParameter(namedParameter.unisonDetune))
        this.#parameterUnisonStereo = this.own(this.bindParameter(namedParameter.unisonStereo))
        this.#parameterLfoShape = this.own(this.bindParameter(namedParameter.lfoWaveform))
        this.#parameterLfoRate = this.own(this.bindParameter(namedParameter.lfoRate))
        this.#parameterLfoTargetTune = this.own(this.bindParameter(namedParameter.lfoTargetTune))
        this.#parameterLfoTargetCutoff = this.own(this.bindParameter(namedParameter.lfoTargetCutoff))
        this.#parameterLfoTargetVolume = this.own(this.bindParameter(namedParameter.lfoTargetVolume))

        this.ownAll(
            context.registerProcessor(this)
        )
        this.readAllParameters()
    }

    computeFrequency(event: NoteEvent): number {return midiToHz(event.pitch + event.cent / 100.0, 440.0)}

    get frequencyMultiplier(): number {return this.#frequencyMultiplier}
    get glideTime(): ppqn {return this.#glideTime}

    get parameterFilterKeyboard(): AutomatableParameter<number> {return this.#parameterFilterKeyboard}
    get parameterLfoShape(): AutomatableParameter<ClassicWaveform> {return this.#parameterLfoShape}
    get parameterLfoRate(): AutomatableParameter<number> {return this.#parameterLfoRate}
    get parameterLfoTargetTune(): AutomatableParameter<number> {return this.#parameterLfoTargetTune}
    get parameterLfoTargetCutoff(): AutomatableParameter<number> {return this.#parameterLfoTargetCutoff}
    get parameterLfoTargetVolume(): AutomatableParameter<number> {return this.#parameterLfoTargetVolume}
    get parameterUnisonDetune(): AutomatableParameter<number> {return this.#parameterUnisonDetune}
    get parameterUnisonStereo(): AutomatableParameter<number> {return this.#parameterUnisonStereo}

    create(): Voice {
        return new VoiceUnison(() =>
            new VaporisateurVoice(this), this.#parameterUnisonCount.getValue())
    }

    get noteEventTarget(): Option<NoteEventTarget & DeviceProcessor> {return Option.wrap(this)}

    introduceBlock(block: Block): void {this.#noteEventInstrument.introduceBlock(block)}
    setNoteEventSource(source: NoteEventSource): Terminable {return this.#noteEventInstrument.setNoteEventSource(source)}

    get incoming(): Processor {return this}
    get outgoing(): Processor {return this}

    reset(): void {
        this.#noteEventInstrument.clear()
        this.#peakBroadcaster.clear()
        this.#voicing.reset()
        this.#audioOutput.clear()
        this.eventInput.clear()
    }

    get uuid(): UUID.Bytes {return this.#adapter.uuid}
    get audioOutput(): AudioBuffer {return this.#audioOutput}
    get adapter(): VaporisateurDeviceBoxAdapter {return this.#adapter}

    handleEvent(event: Event): void {
        if (NoteLifecycleEvent.isStart(event)) {
            this.#voicing.start(event)
        } else if (NoteLifecycleEvent.isStop(event)) {
            this.#voicing.stop(event.id)
        }
    }

    processAudio(block: Block, fromIndex: int, toIndex: int): void {
        this.#voicing.process(this.#audioOutput, block, fromIndex, toIndex)
    }

    parameterChanged(parameter: AutomatableParameter): void {
        if (parameter === this.#parameterVolume) {
            this.gain = dbToGain(this.#parameterVolume.getValue())
        } else if (parameter === this.#parameterOctave || parameter === this.#parameterTune) {
            this.#frequencyMultiplier = 2.0 ** (this.#parameterOctave.getValue() + this.#parameterTune.getValue() / 1200.0)
        } else if (parameter === this.#parameterAttack) {
            this.env_attack = this.#parameterAttack.getValue()
        } else if (parameter === this.#parameterDecay) {
            this.env_decay = this.#parameterDecay.getValue()
        } else if (parameter === this.#parameterSustain) {
            this.env_sustain = this.#parameterSustain.getValue()
        } else if (parameter === this.#parameterRelease) {
            this.env_release = this.#parameterRelease.getValue()
        } else if (parameter === this.#parameterWaveform) {
            this.osc_waveform = asEnumValue(this.#parameterWaveform.getValue(), ClassicWaveform)
        } else if (parameter === this.#parameterCutoff) {
            this.flt_cutoff = this.#parameterCutoff.getUnitValue()
        } else if (parameter === this.#parameterResonance) {
            this.flt_resonance = this.#parameterResonance.getValue()
        } else if (parameter === this.#parameterFilterEnvelope) {
            this.flt_env_amount = this.#parameterFilterEnvelope.getValue()
        } else if (parameter === this.#parameterFilterOrder) {
            this.flt_order = this.#parameterFilterOrder.getValue()
        } else if (parameter === this.#parameterGlideTime) {
            this.#glideTime = this.#parameterGlideTime.getValue() * PPQN.Bar
        } else if (parameter === this.#parameterVoicingMode) {
            const mode = this.#parameterVoicingMode.getValue()
            switch (mode) {
                case VoicingMode.Monophonic: {
                    this.#voicing.strategy = new MonophonicStrategy(this)
                    return
                }
                case VoicingMode.Polyphonic: {
                    this.#voicing.strategy = new PolyphonicStrategy(this)
                    return
                }
                default:
                    return panic(`Unknown VoicingMode '${mode}'`)
            }
        }
    }

    finishProcess(): void {
        this.#audioOutput.assertSanity()
        this.#peakBroadcaster.process(this.#audioOutput.getChannel(0), this.#audioOutput.getChannel(1))
    }

    toString(): string {return `{VaporisateurDevice}`}
}

