import {DefaultObservableValue, int, Option, panic, RuntimeNotifier, TimeSpan} from "@opendaw/lib-std"
import {AnimationFrame} from "@opendaw/lib-dom"
import {Wait} from "@opendaw/lib-runtime"
import {ExportStemsConfiguration} from "@opendaw/studio-adapters"
import {Project} from "./project"
import {AudioWorklets} from "./AudioWorklets"

export namespace AudioOfflineRenderer {
    export const start = async (source: Project,
                                optExportConfiguration: Option<ExportStemsConfiguration>,
                                sampleRate: int = 48_000): Promise<AudioBuffer> => {
        const numStems = ExportStemsConfiguration.countStems(optExportConfiguration)
        if (numStems === 0) {return panic("Nothing to export")}
        const project = source.copy()
        const progress = new DefaultObservableValue(0.0)
        const dialog = RuntimeNotifier.progress({headline: "Rendering...", progress})
        project.boxGraph.beginTransaction()
        project.timelineBox.loopArea.enabled.setValue(false)
        project.boxGraph.endTransaction()
        const durationInPulses = project.timelineBox.durationInPulses.getValue()
        const numSamples = Math.ceil(project.tempoMap.intervalToSeconds(0, durationInPulses) * sampleRate)
        const context = new OfflineAudioContext(numStems * 2, numSamples, sampleRate)
        const durationInSeconds = numSamples / sampleRate
        const worklets = await AudioWorklets.createFor(context)
        const engineWorklet = worklets.createEngine({
            project: project,
            exportConfiguration: optExportConfiguration.unwrapOrUndefined()
        })
        engineWorklet.play()
        engineWorklet.connect(context.destination)
        await engineWorklet.isReady()
        while (!await engineWorklet.queryLoadingComplete()) {await Wait.timeSpan(TimeSpan.seconds(1))}
        const terminable = AnimationFrame.add(() => progress.setValue(context.currentTime / durationInSeconds))
        const buffer = await context.startRendering()
        terminable.terminate()
        dialog.terminate()
        project.terminate()
        return buffer
    }
}