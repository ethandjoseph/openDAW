import css from "./Footer.sass?inline"
import {createElement, LocalLink} from "@opendaw/lib-jsx"
import {isDefined, Lifecycle, Terminator, TimeSpan} from "@opendaw/lib-std"
import {StudioService} from "@/service/StudioService"
import {Surface} from "@/ui/surface/Surface"
import {AnimationFrame, Events, Html} from "@opendaw/lib-dom"
import {Runtime} from "@opendaw/lib-runtime"
import {FooterLabel} from "@/service/FooterLabel"
import {Colors, ProjectMeta} from "@opendaw/studio-core"
import {UserCounter} from "@/UserCounter"

const className = Html.adoptStyleSheet(css, "footer")

type Construct = { lifecycle: Lifecycle, service: StudioService }

export const Footer = ({lifecycle, service}: Construct) => {
    return (
        <footer className={className}>
            <div title="Online" onInit={element => {
                const updateOnline = () => element.textContent = navigator.onLine ? "Yes" : "No"
                lifecycle.ownAll(
                    Events.subscribe(window, "online", updateOnline),
                    Events.subscribe(window, "offline", updateOnline))
                updateOnline()
            }}/>
            <div className="name"
                 title="Project"
                 onInit={element => {
                     const profileLifecycle = lifecycle.own(new Terminator())
                     lifecycle.ownAll(
                         Events.subscribe(element, "dblclick", event => {
                             const optProfile = service.projectProfileService.getValue()
                             if (optProfile.isEmpty()) {return}
                             const profile = optProfile.unwrap()
                             const name = profile.meta.name
                             if (isDefined(name)) {
                                 Surface.get(element).requestFloatingTextInput(event, name)
                                     .then(name => profile.updateMetaData("name", name))
                             }
                         }),
                         service.projectProfileService.catchupAndSubscribe(owner => {
                             profileLifecycle.terminate()
                             const optProfile = owner.getValue()
                             if (optProfile.nonEmpty()) {
                                 const profile = optProfile.unwrap()
                                 const observer = (meta: ProjectMeta) => element.textContent = meta.name
                                 profileLifecycle.own(profile.subscribeMetaData(observer))
                                 observer(profile.meta)
                             } else {
                                 element.textContent = "⏏︎"
                             }
                         }))
                 }}/>
            <div title="SampleRate">{service.audioContext.sampleRate}</div>
            <div title="Latency" onInit={element => {
                lifecycle.own(Runtime.scheduleInterval(() => {
                    const outputLatency = service.audioContext.outputLatency
                    if (outputLatency > 0.0) {
                        element.textContent = `${(outputLatency * 1000.0).toFixed(1)}ms`
                    }
                }, 1000))
            }}>N/A
            </div>
            <div title="FPS"
                 onInit={element => {
                     let frame = 0 | 0
                     let lastTime = Date.now()
                     lifecycle.own(AnimationFrame.add(() => {
                         if (Date.now() - lastTime >= 1000) {
                             element.textContent = String(frame)
                             lastTime = Date.now()
                             frame = 0
                         } else {frame++}
                     }))
                 }}>0
            </div>
            <div title="Build Version">{service.buildInfo.uuid}</div>
            <div title="Build Time" onInit={element => {
                const buildDateMillis = new Date(service.buildInfo.date).getTime()
                const update = () => element.textContent =
                    TimeSpan.millis(buildDateMillis - new Date().getTime()).toUnitString()
                setInterval(update, 1000)
                update()
            }}/>
            <div title="Users" onInit={async element => {
                const counter = new UserCounter("https://api.opendaw.studio/users/user-counter.php")
                element.textContent = String(await counter.start())
                setInterval(async () => element.textContent = String(await counter.updateUserCount()), 30000)
                window.addEventListener("beforeunload", () => counter.stop())
            }}>#
            </div>
            <div style={{display: "contents"}}
                 onInit={element => service.registerFooter((): FooterLabel => {
                     const label: HTMLElement = <div/>
                     element.appendChild(label)
                     return {
                         setTitle: (value: string) => label.title = value,
                         setValue: (value: string) => label.textContent = value,
                         terminate: () => {if (label.isConnected) {label.remove()}}
                     } satisfies FooterLabel
                 })}/>
            <div style={{flex: "1"}}/>
            <div style={{color: Colors.cream}}>
                <LocalLink href="/privacy">Privacy</LocalLink> · <LocalLink href="/imprint">Imprint</LocalLink>
            </div>
        </footer>
    )
}