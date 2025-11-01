import {asEnumValue, clamp, int, Option, Terminable, unitValue, UUID} from "@opendaw/lib-std"
import {
    AudioBuffer,
    BandLimitedOscillator,
    BiquadCoeff,
    BiquadMono,
    dbToGain,
    Event,
    ppqn,
    RenderQuantum,
    Smooth,
    velocityToGain,
    Waveform
} from "@opendaw/lib-dsp"
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
import {ADSR} from "../../envelopes/ADSR"
import {Voicing} from "../../voicing/Voicing"

export class VaporisateurDeviceProcessor extends AudioProcessor implements InstrumentDeviceProcessor, NoteEventTarget {
    readonly #adapter: VaporisateurDeviceBoxAdapter

    readonly #voicing: Voicing<VaporisateurVoice>
    readonly #noteEventInstrument: NoteEventInstrument
    readonly #audioOutput: AudioBuffer
    readonly #peakBroadcaster: PeakBroadcaster
    readonly #parameterVolume: AutomatableParameter<number>
    readonly #parameterOctave: AutomatableParameter<number>
    readonly #parameterTune: AutomatableParameter<number>
    readonly #parameterAttack: AutomatableParameter<number>
    readonly #parameterRelease: AutomatableParameter<number>
    readonly #parameterWaveform: AutomatableParameter<number>
    readonly #parameterCutoff: AutomatableParameter<number>
    readonly #parameterResonance: AutomatableParameter<number>
    readonly #parameterFilterEnvelope: AutomatableParameter<number>

    gain: number = 1.0
    freqMult: number = 1.0
    attack: number = 1.0
    release: number = 1.0
    waveform: Waveform = Waveform.sine
    cutoff: number = 1.0
    resonance: number = Math.SQRT1_2
    filterEnvelope: number = 0.0

    constructor(context: EngineContext, adapter: VaporisateurDeviceBoxAdapter) {
        super(context)

        this.#adapter = adapter

        this.#voicing = new Voicing({create: () => new VaporisateurVoice(this)})
        this.#noteEventInstrument = new NoteEventInstrument(this, context.broadcaster, adapter.audioUnitBoxAdapter().address)
        this.#audioOutput = new AudioBuffer()
        this.#peakBroadcaster = this.own(new PeakBroadcaster(context.broadcaster, adapter.address))

        this.#parameterVolume = this.own(this.bindParameter(this.#adapter.namedParameter.volume))
        this.#parameterOctave = this.own(this.bindParameter(this.#adapter.namedParameter.octave))
        this.#parameterTune = this.own(this.bindParameter(this.#adapter.namedParameter.tune))
        this.#parameterAttack = this.own(this.bindParameter(this.#adapter.namedParameter.attack))
        this.#parameterRelease = this.own(this.bindParameter(this.#adapter.namedParameter.release))
        this.#parameterWaveform = this.own(this.bindParameter(this.#adapter.namedParameter.waveform))
        this.#parameterCutoff = this.own(this.bindParameter(this.#adapter.namedParameter.cutoff))
        this.#parameterResonance = this.own(this.bindParameter(this.#adapter.namedParameter.resonance))
        this.#parameterFilterEnvelope = this.own(this.bindParameter(this.#adapter.namedParameter.filterEnvelope))

        this.own(context.registerProcessor(this))
        this.readAllParameters()
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
            this.#voicing.start(event, this.freqMult)
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
            this.freqMult = 2.0 ** (this.#parameterOctave.getValue() + this.#parameterTune.getValue() / 1200.0)
        } else if (parameter === this.#parameterAttack) {
            this.attack = this.#parameterAttack.getValue()
        } else if (parameter === this.#parameterRelease) {
            this.release = this.#parameterRelease.getValue()
        } else if (parameter === this.#parameterWaveform) {
            this.waveform = asEnumValue(this.#parameterWaveform.getValue(), Waveform)
        } else if (parameter === this.#parameterCutoff) {
            this.cutoff = this.#parameterCutoff.getValue()
        } else if (parameter === this.#parameterResonance) {
            this.resonance = this.#parameterResonance.getValue()
        } else if (parameter === this.#parameterFilterEnvelope) {
            this.filterEnvelope = this.#parameterFilterEnvelope.getValue()
        }
    }

    finishProcess(): void {
        this.#audioOutput.assertSanity()
        this.#peakBroadcaster.process(this.#audioOutput.getChannel(0), this.#audioOutput.getChannel(1))
    }

    toString(): string {return `{VaporisateurDevice}`}
}

class VaporisateurVoice implements Voice {
    readonly device: VaporisateurDeviceProcessor
    readonly osc: BandLimitedOscillator
    readonly buffer: Float32Array
    readonly filterCoeff: BiquadCoeff
    readonly filterProcessor: BiquadMono
    readonly adsr: ADSR
    readonly adsrBuffer: Float32Array
    readonly freqBuffer: Float32Array
    readonly gainSmooth: Smooth

    id: int = -1
    frequency: number = 0.0
    velocity: unitValue = 0.0
    targetFrequency: number = NaN
    glidePosition: number = 0.0
    glideDuration: number = 0.0

    phase: number = 0.0

    constructor(device: VaporisateurDeviceProcessor) {
        this.device = device

        this.osc = new BandLimitedOscillator(sampleRate)
        this.buffer = new Float32Array(RenderQuantum)
        this.filterCoeff = new BiquadCoeff()
        this.filterProcessor = new BiquadMono()
        this.adsr = new ADSR(sampleRate)
        this.adsr.set(this.device.attack, 0.0, 1.0, this.device.release)
        this.adsr.gateOn()
        this.adsrBuffer = new Float32Array(RenderQuantum)
        this.freqBuffer = new Float32Array(RenderQuantum)
        this.gainSmooth = new Smooth(0.003, sampleRate)
    }

    start(id: int, frequency: number, velocity: unitValue): void {
        this.id = id
        this.frequency = frequency
        this.velocity = velocity
    }

    stop(): void {this.adsr.gateOff()}

    forceStop(): void {this.adsr.forceStop()}

    startGlide(targetFrequency: number, glideDuration: ppqn): void {
        this.targetFrequency = targetFrequency
        this.glidePosition = 0.0
        this.glideDuration = glideDuration
    }

    get gate(): boolean {return this.adsr.gate}

    process(output: AudioBuffer, block: Block, fromIndex: int, toIndex: int): boolean {
        const gain = velocityToGain(this.velocity) * this.device.gain * dbToGain(-15)
        const waveform = this.device.waveform
        const ppqnPerSample = (block.p1 - block.p0) / (block.s1 - block.s0)
        const cutoffMapping = this.device.adapter.namedParameter.cutoff.valueMapping
        const cutoff = cutoffMapping.x(this.device.cutoff)
        const resonance = this.device.resonance
        const filterEnvelope = this.device.filterEnvelope
        const l = output.getChannel(0)
        const r = output.getChannel(1)

        if (isNaN(this.targetFrequency)) {
            // no glide → fill with constant frequency
            this.freqBuffer.fill(this.frequency, fromIndex, toIndex)
        } else {
            for (let i = fromIndex; i < toIndex; i++) {
                this.glidePosition += ppqnPerSample / this.glideDuration
                if (this.glidePosition >= 1.0) {
                    this.glidePosition = 1.0
                    this.frequency = this.targetFrequency
                    this.targetFrequency = NaN
                    this.freqBuffer.fill(this.frequency, i, toIndex)
                    break
                }
                this.freqBuffer[i] = this.frequency + (this.targetFrequency - this.frequency) * this.glidePosition
            }
        }

        this.osc.generateFromFrequencies(this.buffer, this.freqBuffer, waveform, fromIndex, toIndex)
        this.adsr.process(this.adsrBuffer, fromIndex, toIndex)
        for (let i = fromIndex; i < toIndex; i++) {
            const env = this.gainSmooth.process(this.adsrBuffer[i])
            this.filterCoeff.setLowpassParams(cutoffMapping.y(clamp(cutoff + env * filterEnvelope, 0.0, 1.0)) / sampleRate, resonance)
            const amp = this.filterProcessor.processFrame(this.filterCoeff, this.buffer[i]) * gain * env
            l[i] += amp
            r[i] += amp
            if (this.adsr.complete && this.gainSmooth.value < 1e-6) {return true}
        }
        return false
    }
}