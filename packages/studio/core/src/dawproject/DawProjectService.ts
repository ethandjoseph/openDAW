import {SampleService} from "../samples"
import {Promises} from "@opendaw/lib-runtime"
import {Files} from "@opendaw/lib-dom"
import {FilePickerAcceptTypes} from "../FilePickerAcceptTypes"
import {Errors, isDefined, Option, panic, RuntimeNotifier} from "@opendaw/lib-std"
import {DawProject} from "./DawProject"
import {DawProjectImport} from "./DawProjectImport"
import {Xml} from "@opendaw/lib-xml"
import {MetaDataSchema} from "@opendaw/lib-dawproject"
import {ProjectProfile} from "../project/ProjectProfile"
import {ProjectSkeleton} from "@opendaw/studio-adapters"

export class DawProjectService {
    constructor(readonly sampleService: SampleService) {}

    async importDawproject(): Promise<Option<ProjectSkeleton>> {
        const {status, value, error} =
            await Promises.tryCatch(Files.open({types: [FilePickerAcceptTypes.DawprojectFileType]}))
        if (status === "rejected") {
            if (Errors.isAbort(error)) {return Option.None}
            return panic(String(error))
        }
        const file = value.at(0)
        if (!isDefined(file)) {return Option.None}
        const arrayBuffer = await file.arrayBuffer()
        const {project: projectSchema, resources} = await DawProject.decode(arrayBuffer)
        const importResult = await Promises.tryCatch(DawProjectImport.read(projectSchema, resources))
        if (importResult.status === "rejected") {
            await RuntimeNotifier.info({headline: "Import Error", message: String(importResult.error)})
            return Option.None
        }
        const {skeleton, audioIds} = importResult.value
        await Promise.all(audioIds
            .map(uuid => resources.fromUUID(uuid))
            .map(resource => this.sampleService.importSample({
                uuid: resource.uuid,
                name: resource.name,
                arrayBuffer: resource.buffer
            })))
        return Option.wrap(skeleton)
    }

    async exportDawproject(profile: ProjectProfile): Promise<void> {
        const {project, meta} = profile
        const {status, error, value: zip} = await Promises.tryCatch(DawProject.encode(project, Xml.element({
            title: meta.name,
            year: new Date().getFullYear().toString(),
            website: "https://opendaw.studio"
        }, MetaDataSchema)))
        if (status === "rejected") {
            return RuntimeNotifier.info({headline: "Export Error", message: String(error)})
        } else {
            const {status, error} = await Promises.tryCatch(Files.save(zip,
                {types: [FilePickerAcceptTypes.DawprojectFileType]}))
            if (status === "rejected" && !Errors.isAbort(error)) {
                throw error
            } else {
                return
            }
        }
    }
}