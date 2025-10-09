import {
    AudioFileBox,
    NanoDeviceBox,
    PlayfieldDeviceBox,
    PlayfieldSampleBox,
    SoundfontDeviceBox,
    SoundfontFileBox,
    TapeDeviceBox,
    VaporisateurDeviceBox
} from "@opendaw/studio-boxes"
import {UUID} from "@opendaw/lib-std"
import {Waveform} from "@opendaw/lib-dsp"
import {BoxGraph, Field} from "@opendaw/lib-box"
import {IconSymbol, TrackType} from "@opendaw/studio-adapters"

import {InstrumentFactory} from "./InstrumentFactory"
import {Pointers} from "@opendaw/studio-enums"

export namespace InstrumentFactories {
    export const Tape: InstrumentFactory = {
        defaultName: "Tape",
        defaultIcon: IconSymbol.Tape,
        description: "Plays audio regions & clips",
        trackType: TrackType.Audio,
        create: (boxGraph: BoxGraph, host: Field<Pointers.InstrumentHost | Pointers.AudioOutput>, name: string, icon: IconSymbol): TapeDeviceBox =>
            TapeDeviceBox.create(boxGraph, UUID.generate(), box => {
                box.label.setValue(name)
                box.icon.setValue(IconSymbol.toName(icon))
                box.flutter.setValue(0.2)
                box.wow.setValue(0.05)
                box.noise.setValue(0.02)
                box.saturation.setValue(0.5)
                box.host.refer(host)
            })
    }

    export const Nano: InstrumentFactory = {
        defaultName: "Nano",
        defaultIcon: IconSymbol.NanoWave,
        description: "Simple sampler",
        trackType: TrackType.Notes,
        create: (boxGraph: BoxGraph, host: Field<Pointers.InstrumentHost | Pointers.AudioOutput>, name: string, icon: IconSymbol): NanoDeviceBox => {
            const fileUUID = UUID.parse("c1678daa-4a47-4cba-b88f-4f4e384663c3")
            const fileDuration = 5.340
            const audioFileBox: AudioFileBox = boxGraph.findBox<AudioFileBox>(fileUUID)
                .unwrapOrElse(() => AudioFileBox.create(boxGraph, fileUUID, box => {
                    box.fileName.setValue("Rhode")
                    box.endInSeconds.setValue(fileDuration)
                }))
            return NanoDeviceBox.create(boxGraph, UUID.generate(), box => {
                box.label.setValue(name)
                box.icon.setValue(IconSymbol.toName(icon))
                box.file.refer(audioFileBox)
                box.host.refer(host)
            })
        }
    }

    export const Playfield: InstrumentFactory = {
        defaultName: "Playfield",
        defaultIcon: IconSymbol.Playfield,
        description: "Drum computer",
        trackType: TrackType.Notes,
        create: (boxGraph: BoxGraph, host: Field<Pointers.InstrumentHost | Pointers.AudioOutput>, name: string, icon: IconSymbol): PlayfieldDeviceBox => {
            const deviceBox = PlayfieldDeviceBox.create(boxGraph, UUID.generate(), box => {
                box.label.setValue(name)
                box.icon.setValue(IconSymbol.toName(icon))
                box.host.refer(host)
            })
            const files = [
                useFile(boxGraph, UUID.parse("8bb2c6e8-9a6d-4d32-b7ec-1263594ef367"), "909 Bassdrum", 0.509),
                useFile(boxGraph, UUID.parse("0017fa18-a5eb-4d9d-b6f2-e2ddd30a3010"), "909 Snare", 0.235),
                useFile(boxGraph, UUID.parse("28d14cb9-1dc6-4193-9dd7-4e881f25f520"), "909 Low Tom", 0.509),
                useFile(boxGraph, UUID.parse("21f92306-d6e7-446c-a34b-b79620acfefc"), "909 Mid Tom", 0.385),
                useFile(boxGraph, UUID.parse("ad503883-8a72-46ab-a05b-a84149953e17"), "909 High Tom", 0.511),
                useFile(boxGraph, UUID.parse("cfee850b-7658-4d08-9e3b-79d196188504"), "909 Rimshot", 0.150),
                useFile(boxGraph, UUID.parse("32a6f36f-06eb-4b84-bb57-5f51103eb9e6"), "909 Clap", 0.507),
                useFile(boxGraph, UUID.parse("e0ac4b39-23fb-4a56-841d-c9e0ff440cab"), "909 Closed Hat", 0.154),
                useFile(boxGraph, UUID.parse("51c5eea4-391c-4743-896a-859692ec1105"), "909 Open Hat", 0.502),
                useFile(boxGraph, UUID.parse("42a56ff6-89b6-4f2e-8a66-5a41d316f4cb"), "909 Crash", 1.055),
                useFile(boxGraph, UUID.parse("87cde966-b799-4efc-a994-069e703478d3"), "909 Ride", 1.720)

            ]
            const samples = files.map((file, index) => PlayfieldSampleBox.create(boxGraph, UUID.generate(), box => {
                box.device.refer(deviceBox.samples)
                box.file.refer(file)
                box.index.setValue(60 + index)
            }))
            samples[7].exclude.setValue(true)
            samples[8].exclude.setValue(true)
            return deviceBox
        }
    }

    export const Vaporisateur: InstrumentFactory = {
        defaultName: "Vaporisateur",
        defaultIcon: IconSymbol.Piano,
        description: "Classic subtractive synthesizer",
        trackType: TrackType.Notes,
        create: (boxGraph: BoxGraph, host: Field<Pointers.InstrumentHost | Pointers.AudioOutput>, name: string, icon: IconSymbol): VaporisateurDeviceBox =>
            VaporisateurDeviceBox.create(boxGraph, UUID.generate(), box => {
                box.label.setValue(name)
                box.icon.setValue(IconSymbol.toName(icon))
                box.tune.setInitValue(0.0)
                box.cutoff.setInitValue(1000.0)
                box.resonance.setInitValue(0.1)
                box.attack.setInitValue(0.005)
                box.release.setInitValue(0.1)
                box.waveform.setInitValue(Waveform.sine)
                box.host.refer(host)
            })
    }

    export const Soundfont: InstrumentFactory = {
        defaultName: "Soundfont",
        defaultIcon: IconSymbol.FileList,
        description: "Soundfont Player",
        trackType: TrackType.Notes,
        create: (boxGraph: BoxGraph,
                 host: Field<Pointers.InstrumentHost | Pointers.AudioOutput>,
                 name: string,
                 icon: IconSymbol): SoundfontDeviceBox => {
            // const soundFontUUIDAsString = "d9f51577-2096-4671-9067-27ca2e12b329" // Upright Piano KW
            const soundFontUUIDAsString = "bf50f600-620f-4735-adbb-2e5f52c17f08"
            const soundfontUUID = UUID.parse(soundFontUUIDAsString)
            const soundfontBox = SoundfontFileBox.create(boxGraph, soundfontUUID,
                box => box.fileName.setValue("Upright Piano KW"))
            return SoundfontDeviceBox.create(boxGraph, UUID.generate(), box => {
                box.label.setValue(name)
                box.icon.setValue(IconSymbol.toName(icon))
                box.host.refer(host)
                box.file.refer(soundfontBox)
            })
        }
    }

    export const Named = {Vaporisateur, Playfield, Nano, Tape, Soundfont}
    export type Keys = keyof typeof Named

    const useFile = (boxGraph: BoxGraph, fileUUID: UUID.Bytes, name: string, duration: number) =>
        boxGraph.findBox<AudioFileBox>(fileUUID)
            .unwrapOrElse(() => AudioFileBox.create(boxGraph, fileUUID, box => {
                box.fileName.setValue(name)
                box.endInSeconds.setValue(duration)
            }))
}