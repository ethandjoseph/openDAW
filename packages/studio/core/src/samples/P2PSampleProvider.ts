import {asDefined, isDefined, isNotUndefined, panic, Progress, UUID} from "@opendaw/lib-std"
import {AudioData, SampleMetaData} from "@opendaw/studio-adapters"
import * as Y from "yjs"
import {WebrtcProvider} from "y-webrtc"
import {SampleProvider} from "./SampleProvider"
import {SampleStorage} from "./SampleStorage"
import {SamplePeaks} from "@opendaw/lib-fusion"

interface SampleStartMessage {
    readonly type: "start"
    readonly uuid: string
    readonly size: number
    readonly metadata: SampleMetaData
}

interface SampleCompleteMessage {
    readonly type: "complete"
    readonly uuid: string
}

interface SampleRequestMessage {
    readonly type: "request"
    readonly uuid: string
}

type SampleMessage = SampleStartMessage | SampleCompleteMessage | SampleRequestMessage

interface ActiveTransfer {
    readonly chunks: ArrayBuffer[]
    expectedSize: number
    receivedSize: number
    metadata: SampleMetaData
    resolve: Function
    reject: Function
    progress: Progress.Handler
    timeout: NodeJS.Timeout
}

export class P2PSampleProvider implements SampleProvider {
    static create(doc: Y.Doc, provider: WebrtcProvider): P2PSampleProvider {
        return new P2PSampleProvider(doc, provider)
    }

    readonly #doc: Y.Doc
    readonly #provider: WebrtcProvider
    readonly #samplesMap: Y.Map<any>
    readonly #CHUNK_SIZE = 16384
    readonly #CHANNEL_LABEL = "openDAW-samples"

    #peerChannels = new Map<string, RTCDataChannel>()
    #activeTransfers = new Map<string, ActiveTransfer>()
    #pendingFetches = new Map<string, Promise<[AudioData, SampleMetaData]>>()

    constructor(doc: Y.Doc, provider: WebrtcProvider) {
        this.#doc = doc
        this.#provider = provider
        this.#samplesMap = doc.getMap("samples")
        console.log(`[P2P] Initializing with provider:`, provider)
        console.log(`[P2P] Provider maxConns:`, (provider as any).maxConns)
        console.log(`[P2P] Provider filterBcConns:`, (provider as any).filterBcConns)
        console.log(`[P2P] Provider room:`, (provider as any).room)
        console.log(`[P2P] Provider webrtcConns size:`, (provider as any).webrtcConns?.size)
        this.#init()
    }

    async fetch(uuid: UUID.Bytes, progress: Progress.Handler): Promise<[AudioData, SampleMetaData]> {
        const uuidAsString = UUID.toString(uuid)
        console.log(`[P2P] Fetching sample: ${uuidAsString}`)
        try {
            const [audio, _, meta] = await SampleStorage.loadSample(UUID.parse(uuidAsString))
            console.log(`[P2P] Sample found in storage: ${uuidAsString}`)
            progress(1.0)
            return [audio, meta]
        } catch (error) {
            console.log(`[P2P] Sample not in storage, requesting from peers: ${uuidAsString}`)
        }
        const existingPromise = this.#pendingFetches.get(uuidAsString)
        if (isNotUndefined(existingPromise)) {
            console.log(`[P2P] Sample already being fetched: ${uuidAsString}`)
            return existingPromise
        }
        this.#requestSampleFromPeers(uuidAsString)
        const promise = new Promise<[AudioData, SampleMetaData]>((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.warn(`[P2P] Sample fetch timeout: ${uuidAsString}`)
                this.#pendingFetches.delete(uuidAsString)
                this.#activeTransfers.delete(uuidAsString)
                reject(new Error(`No sample source available for ${uuid}`))
            }, 30000)
            this.#activeTransfers.set(uuidAsString, {
                chunks: [],
                expectedSize: 0,
                receivedSize: 0,
                metadata: {} as SampleMetaData,
                resolve,
                reject,
                progress,
                timeout
            })
        })
        this.#pendingFetches.set(uuidAsString, promise)
        return promise
    }

    #requestSampleFromPeers(uuid: string): void {
        console.log(`[P2P] Requesting sample from ${this.#peerChannels.size} peers: ${uuid}`)
        this.#peerChannels.forEach(channel => {
            if (channel.readyState === "open") {
                channel.send(JSON.stringify({
                    type: "request",
                    uuid: uuid
                }))
            }
        })
    }

    async share(uuidAsString: string, audioData: AudioData, peaks: ArrayBuffer, metadata: SampleMetaData): Promise<void> {
        console.log(`[P2P] Sharing sample: ${uuidAsString}`)
        await SampleStorage.saveSample({
            uuid: UUID.parse(uuidAsString),
            audio: audioData,
            peaks: peaks,
            meta: metadata
        })
        this.#samplesMap.set(uuidAsString, {
            uuid: uuidAsString,
            ownerId: this.#getMyId(),
            metadata,
            timestamp: Date.now()
        })
        const zipData = await this.#createZipFile(audioData, peaks, metadata)
        console.log(`[P2P] Broadcasting sample to ${this.#peerChannels.size} peers (${zipData.byteLength} bytes): ${uuidAsString}`)
        this.#peerChannels.forEach((channel) => {
            if (channel.readyState === "open") {
                this.#sendSample(channel, uuidAsString, zipData, metadata)
            }
        })
    }

    async #createZipFile(audioData: AudioData, peaks: ArrayBuffer, metadata: SampleMetaData): Promise<ArrayBuffer> {
        const {default: JSZip} = await import("jszip")
        const zip = new JSZip()
        zip.file("version", "1")
        zip.file("metadata.json", JSON.stringify(metadata))
        zip.file("audio.bin", this.#audioDataToArrayBuffer(audioData), {binary: true})
        zip.file("peaks.bin", peaks, {binary: true})
        return await zip.generateAsync({type: "arraybuffer"})
    }

    async #extractZipFile(zipBuffer: ArrayBuffer): Promise<{
        audioData: AudioData,
        peaks: ArrayBuffer,
        metadata: SampleMetaData
    }> {
        const {default: JSZip} = await import("jszip")
        const zip = new JSZip()
        await zip.loadAsync(zipBuffer)
        const version = await zip.file("version")?.async("string")
        if (version !== "1") {
            return panic(`Unsupported zip version: ${version}`)
        }
        const metadataText = await zip.file("metadata.json")?.async("string")
        if (!isDefined(metadataText)) {
            return panic("Missing metadata.json in zip")
        }
        const metadata = JSON.parse(metadataText)
        const audioBuffer = await zip.file("audio.bin")?.async("arraybuffer")
        if (!isDefined(audioBuffer)) {
            return panic("Missing audio.bin in zip")
        }
        const peaks = await zip.file("peaks.bin")?.async("arraybuffer")
        if (!isDefined(peaks)) {
            return panic("Missing peaks.bin in zip")
        }
        const audioData = this.#arrayBufferToAudioData(audioBuffer)
        return {audioData, peaks, metadata}
    }

    #init(): void {
        this.#setupPeers()
        this.#setupSampleListener()
    }

    #setupPeers(): void {
        console.log(`[P2P] Setting up peer management`)
        this.#provider.on("peers", (event: {
            added: string[],
            removed: string[],
            webrtcPeers: string[],
            bcPeers: string[]
        }) => {
            console.log(`[P2P] Peers event:`, event)
            event.added.forEach(peerId => {
                console.log(`[P2P] Peer connected: ${peerId}`)
                if (event.webrtcPeers.includes(peerId)) {
                    console.log(`[P2P] Setting up WebRTC data channel for: ${peerId}`)
                    this.#createChannel(peerId)
                    this.#setupIncomingChannelHandler(peerId)
                } else if (event.bcPeers.includes(peerId)) {
                    console.log(`[P2P] Peer is using BroadcastChannel (same device): ${peerId}`)
                    console.log(`[P2P] Sample sharing not available for BroadcastChannel peers`)
                }
            })
            event.removed.forEach(peerId => {
                console.log(`[P2P] Peer disconnected: ${peerId}`)
                this.#peerChannels.delete(peerId)
            })
            console.log(`[P2P] Total WebRTC peers: ${event.webrtcPeers.length}`)
            console.log(`[P2P] Total BroadcastChannel peers: ${event.bcPeers.length}`)
            console.log(`[P2P] Total active data channels: ${this.#peerChannels.size}`)
        })
    }

    #setupIncomingChannelHandler(peerId: string): void {
        const conn = (this.#provider as any).webrtcConns?.get(peerId)
        if (!conn?.peer) return
        conn.peer.ondatachannel = (event: RTCDataChannelEvent) => {
            if (event.channel.label === this.#CHANNEL_LABEL) {
                console.log(`[P2P] Incoming data channel from: ${peerId}`)
                this.#setupChannel(event.channel, peerId)
            }
        }
    }

    #createChannel(peerId: string): void {
        console.log(`[P2P] Creating data channel for peer: ${peerId}`)
        const conn = (this.#provider as any).webrtcConns?.get(peerId)
        if (!conn?.peer) {
            console.warn(`[P2P] No WebRTC connection found for peer: ${peerId}`)
            return
        }
        console.log(`[P2P] WebRTC connection state for ${peerId}:`, conn.peer.connectionState)
        const channel = conn.peer.createDataChannel(this.#CHANNEL_LABEL, {
            ordered: true,
            maxRetransmits: 3
        })
        this.#setupChannel(channel, peerId)
    }

    #setupChannel(channel: RTCDataChannel, peerId: string): void {
        channel.binaryType = "arraybuffer"
        channel.onopen = () => {
            console.log(`[P2P] Data channel opened: ${peerId}`)
            this.#peerChannels.set(peerId, channel)
        }
        channel.onclose = () => {
            console.log(`[P2P] Data channel closed: ${peerId}`)
            this.#peerChannels.delete(peerId)
        }
        channel.onmessage = (event) => this.#handleMessage(event.data, peerId)
    }

    #setupSampleListener(): void {
        this.#samplesMap.observe((event: Y.YMapEvent<any>) => {
            event.changes.keys.forEach((change, uuid) => {
                if (change.action === "add") {
                    const sampleRef = this.#samplesMap.get(uuid)
                    if (sampleRef?.ownerId === this.#getMyId()) {
                        console.log(`[P2P] Own sample reference added: ${uuid}`)
                    }
                }
            })
        })
    }

    #sendSample(channel: RTCDataChannel, uuid: string, zipData: ArrayBuffer, metadata: SampleMetaData): void {
        console.log(`[P2P] Starting sample transfer: ${uuid} (${zipData.byteLength} bytes)`)
        channel.send(JSON.stringify({
            type: "start",
            uuid,
            size: zipData.byteLength,
            metadata
        }))
        const chunks = Math.ceil(zipData.byteLength / this.#CHUNK_SIZE)
        for (let i = 0; i < chunks; i++) {
            const chunk = zipData.slice(i * this.#CHUNK_SIZE, (i + 1) * this.#CHUNK_SIZE)
            channel.send(chunk)
        }
        channel.send(JSON.stringify({type: "complete", uuid}))
        console.log(`[P2P] Sample transfer completed: ${uuid} (${chunks} chunks)`)
    }

    #handleMessage(data: string | ArrayBuffer, peerId: string): void {
        if (typeof data === "string") {
            const msg: SampleMessage = JSON.parse(data)
            if (msg.type === "start") {
                console.log(`[P2P] Receiving sample from ${peerId}: ${msg.uuid} (${msg.size} bytes)`)
                const transfer = this.#activeTransfers.get(msg.uuid)
                if (isNotUndefined(transfer)) {
                    transfer.expectedSize = msg.size
                    transfer.metadata = msg.metadata
                } else {
                    console.warn(`[P2P] Received sample start for unknown transfer: ${msg.uuid}`)
                }
            } else if (msg.type === "complete") {
                console.log(`[P2P] Sample transfer complete from ${peerId}: ${msg.uuid}`)
                this.#complete(msg.uuid)
            } else if (msg.type === "request") {
                console.log(`[P2P] Sample request from ${peerId}: ${msg.uuid}`)
                this.#handleSampleRequest(msg.uuid)
            }
        } else {
            const uuid = Array.from(this.#activeTransfers.keys()).find(id => {
                const transfer = this.#activeTransfers.get(id)
                if (isNotUndefined(transfer)) {
                    return transfer.receivedSize < transfer.expectedSize
                }
                return false
            })
            if (isNotUndefined(uuid)) {
                const transfer = this.#activeTransfers.get(uuid)
                if (isNotUndefined(transfer)) {
                    transfer.chunks.push(data)
                    transfer.receivedSize += data.byteLength
                    const progress = transfer.receivedSize / transfer.expectedSize
                    console.log(`[P2P] Receiving sample ${uuid}: ${Math.round(progress * 100)}% (${transfer.receivedSize}/${transfer.expectedSize} bytes)`)
                    transfer.progress(progress)
                }
            }
        }
    }

    #handleSampleRequest(uuid: string): void {
        SampleStorage.loadSample(UUID.parse(uuid)).then(async ([audio, peaks, meta]) => {
            console.log(`[P2P] Responding to sample request: ${uuid}`)
            const zipData = await this.#createZipFile(audio, (peaks as SamplePeaks).toArrayBuffer() as ArrayBuffer, meta)
            this.#peerChannels.forEach(channel => {
                if (channel.readyState === "open") {
                    this.#sendSample(channel, uuid, zipData, meta)
                }
            })
        }).catch(error => {
            console.log(`[P2P] Sample not available for request: ${uuid}`, error)
        })
    }

    async #complete(uuid: string): Promise<void> {
        const transfer = asDefined(this.#activeTransfers.get(uuid), `Expected active transfer for ${uuid}`)
        console.log(`[P2P] Reconstructing sample: ${uuid}`)
        const zipBuffer = new ArrayBuffer(transfer.expectedSize)
        const zipView = new Uint8Array(zipBuffer)
        let offset = 0
        transfer.chunks.forEach(chunk => {
            zipView.set(new Uint8Array(chunk), offset)
            offset += chunk.byteLength
        })
        try {
            const {audioData, peaks, metadata} = await this.#extractZipFile(zipBuffer)
            await SampleStorage.saveSample({
                uuid: UUID.parse(uuid),
                audio: audioData,
                peaks: peaks,
                meta: metadata
            })
            console.log(`[P2P] Sample saved successfully: ${uuid}`)
            transfer.resolve([audioData, metadata])
            this.#pendingFetches.delete(uuid)
        } catch (error) {
            console.error(`[P2P] Failed to save sample ${uuid}:`, error)
            transfer.reject(error)
            this.#pendingFetches.delete(uuid)
        } finally {
            clearTimeout(transfer.timeout)
        }
        this.#activeTransfers.delete(uuid)
    }

    #getMyId(): string {
        return this.#provider.awareness.clientID.toString()
    }

    #audioDataToArrayBuffer(audioData: AudioData): ArrayBuffer {
        const totalSamples = audioData.numberOfFrames * audioData.numberOfChannels
        const buffer = new ArrayBuffer(4 + 4 + 4 + totalSamples * 4)
        const view = new DataView(buffer)
        view.setUint32(0, audioData.sampleRate, true)
        view.setUint32(4, audioData.numberOfFrames, true)
        view.setUint32(8, audioData.numberOfChannels, true)
        let offset = 12
        for (let frame = 0; frame < audioData.numberOfFrames; frame++) {
            for (let channel = 0; channel < audioData.numberOfChannels; channel++) {
                view.setFloat32(offset, audioData.frames[channel][frame], true)
                offset += 4
            }
        }
        return buffer
    }

    #arrayBufferToAudioData(buffer: ArrayBuffer): AudioData {
        const view = new DataView(buffer)
        const sampleRate = view.getUint32(0, true)
        const numberOfFrames = view.getUint32(4, true)
        const numberOfChannels = view.getUint32(8, true)
        const frames: Float32Array[] = []
        for (let channel = 0; channel < numberOfChannels; channel++) {
            frames.push(new Float32Array(numberOfFrames))
        }
        let offset = 12
        for (let frame = 0; frame < numberOfFrames; frame++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                frames[channel][frame] = view.getFloat32(offset, true)
                offset += 4
            }
        }
        return {sampleRate, numberOfFrames, numberOfChannels, frames}
    }
}