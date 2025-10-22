import css from "./FoldDeviceEditor.sass?inline"
import {DeviceHost, FoldDeviceBoxAdapter} from "@opendaw/studio-adapters"
import {Lifecycle, TAU} from "@opendaw/lib-std"
import {createElement} from "@opendaw/lib-jsx"
import {DeviceEditor} from "@/ui/devices/DeviceEditor.tsx"
import {MenuItems} from "@/ui/devices/menu-items.ts"
import {ControlBuilder} from "@/ui/devices/ControlBuilder.tsx"
import {DevicePeakMeter} from "@/ui/devices/panel/DevicePeakMeter.tsx"
import {Html} from "@opendaw/lib-dom"
import {StudioService} from "@/service/StudioService"
import {Colors, EffectFactories} from "@opendaw/studio-core"
import {CanvasPainter} from "@/ui/canvas/painter"

const className = Html.adoptStyleSheet(css, "FoldDeviceEditor")

type Construct = {
    lifecycle: Lifecycle
    service: StudioService
    adapter: FoldDeviceBoxAdapter
    deviceHost: DeviceHost
}

const wavefold = (x: number, t: number): number => {
    const scaled = 0.25 * t * x + 0.25
    return 4.0 * (Math.abs(scaled - Math.round(scaled)) - 0.25)
}

export const FoldDeviceEditor = ({lifecycle, service, adapter, deviceHost}: Construct) => {
    const {project} = service
    const {editing, midiLearning} = project
    return (
        <DeviceEditor lifecycle={lifecycle}
                      project={project}
                      adapter={adapter}
                      populateMenu={parent => MenuItems.forEffectDevice(parent, service, deviceHost, adapter)}
                      populateControls={() => (
                          <div className={className}>
                              <canvas onInit={canvas => {
                                  const amount = adapter.namedParameter.amount
                                  const painter = lifecycle.own(new CanvasPainter(canvas, painter => {
                                      const {devicePixelRatio, context, actualWidth, actualHeight} = painter
                                      const halfHeight = actualHeight * 0.5
                                      const toY = (value: number) => (halfHeight - devicePixelRatio) * value + halfHeight
                                      context.lineWidth = 2.0
                                      context.beginPath()
                                      context.moveTo(0, toY(0.0))
                                      for (let x = 1; x <= actualWidth; x++) {
                                          context.lineTo(x, toY(wavefold(Math.sin(x / actualWidth * TAU), amount.getValue())))
                                      }
                                      context.strokeStyle = Colors.blue
                                      context.stroke()
                                  }))
                                  lifecycle.own(amount.catchupAndSubscribe(() => {
                                      painter.requestUpdate()
                                  }))
                              }}/>
                              {Object.values(adapter.namedParameter)
                                  .map((parameter) => ControlBuilder.createKnob({
                                      lifecycle,
                                      editing,
                                      midiLearning,
                                      adapter,
                                      parameter
                                  }))}
                          </div>
                      )}
                      populateMeter={() => (
                          <DevicePeakMeter lifecycle={lifecycle}
                                           receiver={project.liveStreamReceiver}
                                           address={adapter.address}/>
                      )}
                      icon={EffectFactories.AudioNamed.Fold.defaultIcon}/>
    )
}