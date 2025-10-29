import css from "./ManualPage.sass?inline"
import {Await, createElement, LocalLink, PageContext, PageFactory} from "@opendaw/lib-jsx"
import {StudioService} from "@/service/StudioService.ts"
import {ThreeDots} from "@/ui/spinner/ThreeDots"
import {BackButton} from "@/ui/pages/BackButton"
import {Markdown} from "@/ui/Markdown"
import {Manuals} from "@/ui/pages/Manuals"
import {Html} from "@opendaw/lib-dom"

const className = Html.adoptStyleSheet(css, "ManualPage")

export const ManualPage: PageFactory<StudioService> = ({service, path}: PageContext<StudioService>) => {
    return (
        <div className={className}>
            <aside>
                <BackButton/>
                <nav>
                    {Manuals.map(([name, url]) => (<LocalLink href={url}>{name}</LocalLink>))}
                </nav>
            </aside>
            <div className="manual">
                <Await factory={() => fetch(`${path ?? "index"}.md?uuid=${service.buildInfo.uuid}`).then(x => x.text())}
                       failure={(error) => `Unknown request (${error.reason})`}
                       loading={() => <ThreeDots/>}
                       success={text => <Markdown text={text}/>}
                />
            </div>
        </div>
    )
}