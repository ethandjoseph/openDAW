import {DefaultObservableValue, Errors, panic, Procedure, Progress, RuntimeNotifier, UUID} from "@opendaw/lib-std"
import {Files} from "@opendaw/lib-dom"
import {Promises} from "@opendaw/lib-runtime"

export namespace AssetService {
    export type ImportArgs = {
        uuid?: UUID.Bytes
        name?: string,
        arrayBuffer: ArrayBuffer,
        progressHandler?: Progress.Handler
    }
}

export abstract class AssetService<T> {
    protected abstract readonly nameSingular: string
    protected abstract readonly namePlural: string

    protected constructor(protected readonly onUpdate: Procedure<T>) {}

    abstract importFile(args: AssetService.ImportArgs): Promise<T>

    protected async browseFiles(multiple: boolean, filePickerSettings: FilePickerOptions): Promise<ReadonlyArray<T>> {
        const {error, status, value: files} =
            await Promises.tryCatch(Files.open({...filePickerSettings, multiple}))
        if (status === "rejected") {
            if (Errors.isAbort(error)) {return []} else {return panic(String(error)) }
        }
        const progress = new DefaultObservableValue(0.0)
        const dialog = RuntimeNotifier.progress({
            headline: `Importing ${files.length === 1 ? this.nameSingular : this.namePlural}...`, progress
        })
        const progressHandler = Progress.split(value => progress.setValue(value), files.length)
        const rejected: Array<string> = []
        const imported: Array<T> = []
        for (const [index, file] of files.entries()) {
            const arrayBuffer = await file.arrayBuffer()
            const {
                status,
                value,
                error
            } = await Promises.tryCatch(this.importFile({
                name: file.name,
                arrayBuffer: arrayBuffer,
                progressHandler: progressHandler[index]
            }))
            if (status === "rejected") {rejected.push(String(error))} else {imported.push(value)}
        }
        dialog.terminate()
        if (rejected.length > 0) {
            await RuntimeNotifier.info({
                headline: `${this.nameSingular} Import Issues`,
                message: `${rejected.join(", ")} could not be imported.`
            })
        }
        return imported
    }
}