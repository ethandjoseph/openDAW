import {AnimationFrame} from "@opendaw/lib-dom"
import {ShadertoyMIDIOutput} from "@/ui/shadertoy/ShadertoyMIDIOutput"
import {MidiData} from "@opendaw/lib-midi"
import {byte, Terminable, unitValue, ValueOwner} from "@opendaw/lib-std"
import {ShadertoyRunner} from "@/ui/shadertoy/ShadertoyRunner"
import {StudioService} from "@/service/StudioService"
import {EngineAddresses} from "@opendaw/studio-adapters"

export const setupShadertoyRunner = (runner: ShadertoyRunner,
                                     canvas: HTMLCanvasElement,
                                     service: StudioService,
                                     highres: ValueOwner<boolean>): Terminable => {
    runner.resetTime()
    const {project: {engine: {position, sampleRate}, liveStreamReceiver}} = service
    return Terminable.many(
        AnimationFrame.add(() => {
            const scale = highres.getValue() ? devicePixelRatio : 1
            canvas.width = canvas.clientWidth * scale
            canvas.height = canvas.clientHeight * scale
            runner.setPPQN(position.getValue())
            runner.render()
        }),
        ShadertoyMIDIOutput.subscribe(message => MidiData.accept(message, {
            controller: (id: byte, value: unitValue) => runner.onMidiCC(id, value),
            noteOn: (note: byte, velocity: byte) => runner.onMidiNoteOn(note, velocity),
            noteOff: (note: byte) => runner.onMidiNoteOff(note)
        })),
        liveStreamReceiver.subscribeFloats(EngineAddresses.PEAKS, (peaks) => runner.setPeaks(peaks)),
        liveStreamReceiver.subscribeFloats(EngineAddresses.SPECTRUM, spectrum => runner.setSpectrum(spectrum, sampleRate)),
        liveStreamReceiver.subscribeFloats(EngineAddresses.WAVEFORM, waveform => runner.setWaveform(waveform))
    )
}