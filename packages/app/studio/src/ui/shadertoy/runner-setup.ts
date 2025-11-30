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
    const peaks = new Float32Array(4)
    const {project: {engine: {position}, liveStreamReceiver}} = service
    return Terminable.many(
        AnimationFrame.add(() => {
            const scale = highres.getValue() ? devicePixelRatio : 1
            canvas.width = canvas.clientWidth * scale
            canvas.height = canvas.clientHeight * scale
            runner.setPeaks(peaks)
            runner.setPPQN(position.getValue())
            runner.render()
        }),
        ShadertoyMIDIOutput.subscribe(message => MidiData.accept(message, {
            controller: (id: byte, value: unitValue) => runner.onMidiCC(id, value),
            noteOn: (note: byte, velocity: byte) => runner.onMidiNoteOn(note, velocity),
            noteOff: (note: byte) => runner.onMidiNoteOff(note)
        })),
        liveStreamReceiver
            .subscribeFloats(EngineAddresses.PEAKS, (enginePeaks) =>
                peaks.set(enginePeaks, 0))
    )
}