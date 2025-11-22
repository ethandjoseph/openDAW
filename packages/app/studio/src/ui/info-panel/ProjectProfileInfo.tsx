import css from "./ProjectInfo.sass?inline"
import {DefaultObservableValue, isDefined, Lifecycle, MutableObservableOption, RuntimeNotifier} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {StudioService} from "@/service/StudioService.ts"
import {Cover} from "./Cover"
import {Events, Html} from "@opendaw/lib-dom"
import {Button} from "@/ui/components/Button"
import {Colors} from "@opendaw/studio-adapters"
import {PublishMusic} from "@/ui/info-panel/PublishMusic"
import {Promises} from "@opendaw/lib-runtime"

const className = Html.adoptStyleSheet(css, "ProjectInfo")

type Construct = {
    lifecycle: Lifecycle
    service: StudioService
}

export const ProjectProfileInfo = ({lifecycle, service}: Construct) => {
    if (!service.hasProfile) {return "No project profile."}
    const {profile} = service
    const {meta, cover} = profile
    const inputName: HTMLInputElement = (
        <input type="text" className="default"
               placeholder="Type in your's project name"
               value={meta.name}/>
    )
    const inputTags: HTMLInputElement = (
        <input type="text" className="default"
               placeholder="Type in your's project tags"
               value={meta.tags.join(", ")}/>
    )
    const inputDescription: HTMLTextAreaElement = (
        <textarea className="default"
                  placeholder="Type in your's project description"
                  value={meta.description}/>
    )
    const coverModel = new MutableObservableOption<ArrayBuffer>(cover.unwrapOrUndefined())
    const form: HTMLElement = (
        <div className="form">
            <div className="label">Name</div>
            <label info="Maximum 128 characters">{inputName}</label>
            <div className="label">Tags</div>
            <label info="Separate tags with commas">{inputTags}</label>
            <div className="label">Description</div>
            <label info="Maximum 512 characters">{inputDescription}</label>
            <div className="label">Cover</div>
            <Cover lifecycle={lifecycle} model={coverModel}/>
            <div className="label"/>
            <Button lifecycle={lifecycle}
                    onClick={async () => {
                        const progressValue = new DefaultObservableValue(0.0)
                        const dialog = RuntimeNotifier.progress({headline: "Uploading Music", progress: progressValue})
                        const {status, value, error} = await Promises.tryCatch(PublishMusic
                            .publishMusic(profile, progress => progressValue.setValue(progress)))
                        dialog.terminate()
                        if (status === "rejected") {
                            return await RuntimeNotifier.info({headline: "Could not upload", message: String(error)})
                        }
                        console.debug("ID", value)
                    }}
                    appearance={{framed: true, color: Colors.purple}}>
                {isDefined(meta.radioToken) ? "Republish" : "Publish"}
            </Button>
        </div>
    )
    lifecycle.ownAll(
        Events.subscribe(form, "keydown", (event: KeyboardEvent) => {
            if (event.code === "Enter" && event.target instanceof HTMLInputElement) {event.target.blur()}
        }),
        Events.subscribe(inputName, "blur",
            () => profile.updateMetaData("name", inputName.value)),
        Events.subscribe(inputDescription, "blur",
            () => profile.updateMetaData("description", inputDescription.value)),
        Events.subscribe(inputTags, "blur",
            () => profile.updateMetaData("tags", inputTags.value.split(",").map(x => x.trim()))),
        Events.subscribe(inputName, "input", () => Html.limitChars(inputDescription, "value", 128)),
        Events.subscribe(inputDescription, "input", () => Html.limitChars(inputDescription, "value", 512)),
        coverModel.subscribe(owner => profile.updateCover(owner))
    )
    return (
        <div className={className}>
            {form}
        </div>
    )
}