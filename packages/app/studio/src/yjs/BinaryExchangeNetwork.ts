import {WebrtcProvider} from "y-webrtc"
import {isAbsent, JSONValue, Terminable} from "@opendaw/lib-std"

interface BinaryStartMessage {
    readonly type: "start"
    readonly transferId: string
    readonly totalSize: number
    readonly payload: JSONValue
}

interface BinaryChunkMessage {
    readonly type: "chunk"
    readonly transferId: string
    readonly chunkIndex: number
    readonly dataSize: number
}

interface BinaryCompleteMessage {
    readonly type: "complete"
    readonly transferId: string
}

type BinaryMetadataMessage = BinaryStartMessage | BinaryChunkMessage | BinaryCompleteMessage

interface BinaryTransfer {
    readonly transferId: string
    readonly totalSize: number
    readonly payload: JSONValue
    readonly onProgress: (progress: number) => void
    readonly onComplete: (data: ArrayBuffer, payload: JSONValue) => void
    chunks: Array<Uint8Array>
    receivedSize: number
    expectingChunkData: boolean
}

interface BinaryPeer {
    readonly peerId: string
    readonly dataChannel: RTCDataChannel
}

export class BinaryExchangeNetwork {
    static readonly CHUNK_SIZE = 16384
    static readonly CHANNEL_LABEL = "opendaw-binary-v1"
    static readonly PROTOCOL_MAGIC = 0xDA
    static readonly MESSAGE_TYPE_METADATA = 0
    static readonly MESSAGE_TYPE_BINARY = 1

    readonly #provider: WebrtcProvider
    readonly #subscription: Terminable

    readonly #peers = new Map<string, BinaryPeer>()
    readonly #activeTransfers = new Map<string, BinaryTransfer>()
    readonly #peerConnectionListeners = new Map<string, boolean>()

    constructor(provider: WebrtcProvider) {
        this.#provider = provider
        this.#subscription = this.#setupPeerListener()
    }

    #setupPeerListener(): Terminable {
        console.debug("[BinaryNetwork] Setting up peer listener")
        const handler = (event: {
            added: ReadonlyArray<string>,
            removed: ReadonlyArray<string>,
            webrtcPeers: ReadonlyArray<string>
        }) => {
            console.debug("[BinaryNetwork] Peer event:", event)
            event.webrtcPeers.forEach(peerId => {
                if (event.added.includes(peerId)) {
                    console.debug(`[BinaryNetwork] WebRTC peer connected: ${peerId}`)
                    this.#setupPeerConnection(peerId)
                }
            })
            event.removed.forEach(peerId => {
                console.debug(`[BinaryNetwork] Peer disconnected: ${peerId}`)
                this.#peers.delete(peerId)
                this.#peerConnectionListeners.delete(peerId)
            })
            console.debug(`[BinaryNetwork] Active peers: ${this.#peers.size}`)
        }
        this.#provider.on("peers", handler)
        return Terminable.create(() => this.#provider.off("peers", handler))
    }

    #setupPeerConnection(peerId: string): void {
        console.debug(`[BinaryNetwork] Setting up peer connection for: ${peerId}`)

        const room = (this.#provider as any).room
        if (isAbsent(room)) {
            console.warn(`[BinaryNetwork] No room available`)
            return
        }

        const webrtcConns = room.webrtcConns
        if (isAbsent(webrtcConns)) {
            console.warn(`[BinaryNetwork] No webrtcConns available`)
            return
        }

        const conn = webrtcConns.get(peerId)
        if (isAbsent(conn)) {
            console.warn(`[BinaryNetwork] No connection for peer: ${peerId}`)
            return
        }

        const simplePeer = conn.peer
        if (isAbsent(simplePeer)) {
            console.warn(`[BinaryNetwork] No simple-peer instance for: ${peerId}`)
            return
        }

        const peerConnection: RTCPeerConnection = simplePeer._pc
        if (isAbsent(peerConnection)) {
            console.warn(`[BinaryNetwork] No RTCPeerConnection for: ${peerId}`)
            return
        }

        if (this.#peerConnectionListeners.has(peerId)) {
            return
        }
        this.#peerConnectionListeners.set(peerId, true)

        console.debug(`[BinaryNetwork] Setting up data channel for: ${peerId}, initiator: ${simplePeer.initiator}`)

        if (simplePeer.initiator) {
            const dataChannel = peerConnection.createDataChannel(BinaryExchangeNetwork.CHANNEL_LABEL, {
                ordered: true,
                maxRetransmits: undefined
            })
            console.debug(`[BinaryNetwork] Created data channel as initiator for: ${peerId}`)
            this.#setupDataChannel(dataChannel, peerId)
        }

        peerConnection.addEventListener('datachannel', (event: RTCDataChannelEvent) => {
            if (event.channel.label === BinaryExchangeNetwork.CHANNEL_LABEL) {
                console.debug(`[BinaryNetwork] Received data channel from: ${peerId}`)
                this.#setupDataChannel(event.channel, peerId)
            }
        })
    }

    #setupDataChannel(channel: RTCDataChannel, peerId: string): void {
        channel.binaryType = "arraybuffer"

        channel.addEventListener('open', () => {
            console.debug(`[BinaryNetwork] Data channel opened with: ${peerId}`)
            this.#peers.set(peerId, { peerId, dataChannel: channel })
        })

        channel.addEventListener('close', () => {
            console.debug(`[BinaryNetwork] Data channel closed with: ${peerId}`)
            this.#peers.delete(peerId)
        })

        channel.addEventListener('error', (error) => {
            console.error(`[BinaryNetwork] Data channel error with ${peerId}:`, error)
        })

        channel.addEventListener('message', (event: MessageEvent) => {
            if (event.data) {
                const uint8Data = new Uint8Array(event.data)
                this.#handleIncomingData(uint8Data)
            }
        })
    }

    sendBinary(data: ArrayBuffer, payload: JSONValue, onProgress: (progress: number) => void): void {
        const transferId = this.#generateTransferId()
        console.debug(`[BinaryNetwork] Starting binary transfer ${transferId} (${data.byteLength} bytes)`)

        let sentCount = 0
        this.#peers.forEach((peer) => {
            if (peer.dataChannel.readyState === "open") {
                this.#sendBinaryToPeer(peer.dataChannel, transferId, data, payload, onProgress)
                sentCount++
            } else {
                console.warn(`[BinaryNetwork] Data channel not open for peer: ${peer.peerId}, state: ${peer.dataChannel.readyState}`)
            }
        })

        if (sentCount === 0) {
            console.warn(`[BinaryNetwork] No open data channels available for transfer`)
        }
    }

    #sendBinaryToPeer(channel: RTCDataChannel, transferId: string, data: ArrayBuffer, payload: JSONValue, onProgress: (progress: number) => void): void {
        const startMessage: BinaryStartMessage = {
            type: "start",
            transferId,
            totalSize: data.byteLength,
            payload
        }
        this.#sendMetadata(channel, startMessage)

        const totalChunks = Math.ceil(data.byteLength / BinaryExchangeNetwork.CHUNK_SIZE)
        for (let i = 0; i < totalChunks; i++) {
            const start = i * BinaryExchangeNetwork.CHUNK_SIZE
            const end = Math.min(start + BinaryExchangeNetwork.CHUNK_SIZE, data.byteLength)
            const chunk = new Uint8Array(data.slice(start, end))

            const chunkMessage: BinaryChunkMessage = {
                type: "chunk",
                transferId,
                chunkIndex: i,
                dataSize: chunk.byteLength
            }
            this.#sendMetadata(channel, chunkMessage)
            this.#sendBinary(channel, chunk)

            onProgress(end / data.byteLength)
        }

        const completeMessage: BinaryCompleteMessage = {
            type: "complete",
            transferId
        }
        this.#sendMetadata(channel, completeMessage)
    }

    #sendMetadata(channel: RTCDataChannel, message: BinaryMetadataMessage): void {
        const json = JSON.stringify(message)
        const encoder = new TextEncoder()
        const jsonData = encoder.encode(json)

        const packet = new Uint8Array(2 + jsonData.byteLength)
        packet[0] = BinaryExchangeNetwork.PROTOCOL_MAGIC
        packet[1] = BinaryExchangeNetwork.MESSAGE_TYPE_METADATA
        packet.set(jsonData, 2)

        channel.send(packet)
    }

    #sendBinary(channel: RTCDataChannel, data: Uint8Array): void {
        const packet = new Uint8Array(2 + data.byteLength)
        packet[0] = BinaryExchangeNetwork.PROTOCOL_MAGIC
        packet[1] = BinaryExchangeNetwork.MESSAGE_TYPE_BINARY
        packet.set(data, 2)

        channel.send(packet)
    }

    #handleIncomingData(data: Uint8Array): void {
        if (data.byteLength < 2) return

        if (data[0] !== BinaryExchangeNetwork.PROTOCOL_MAGIC) {
            console.debug(`[BinaryNetwork] Ignoring non-protocol message (magic: ${data[0]}, expected: ${BinaryExchangeNetwork.PROTOCOL_MAGIC})`)
            return
        }

        const messageType = data[1]
        const payload = data.subarray(2)

        if (messageType === BinaryExchangeNetwork.MESSAGE_TYPE_METADATA) {
            try {
                const decoder = new TextDecoder()
                const json = decoder.decode(payload)
                const message: BinaryMetadataMessage = JSON.parse(json)
                this.#handleMetadataMessage(message)
            } catch (error) {
                console.warn(`[BinaryNetwork] Failed to decode metadata:`, error)
            }
        } else if (messageType === BinaryExchangeNetwork.MESSAGE_TYPE_BINARY) {
            this.#handleBinaryChunk(payload)
        } else {
            console.warn(`[BinaryNetwork] Unknown message type: ${messageType}`)
        }
    }

    setTransferHandlers(onProgress: (transferId: string, progress: number) => void, onComplete: (transferId: string, data: ArrayBuffer, payload: JSONValue) => void): void {
        this.#defaultOnProgress = onProgress
        this.#defaultOnComplete = onComplete
    }

    #defaultOnProgress = (transferId: string, progress: number) => {
        console.debug(`[BinaryNetwork] Transfer ${transferId}: ${Math.round(progress * 100)}%`)
    }

    #defaultOnComplete = (transferId: string, data: ArrayBuffer, payload: JSONValue) => {
        console.debug(`[BinaryNetwork] Transfer ${transferId} completed (${data.byteLength} bytes) with payload:`, payload)
    }

    #handleMetadataMessage(message: BinaryMetadataMessage): void {
        switch (message.type) {
            case "start":
                this.#handleTransferStart(message)
                break
            case "chunk":
                this.#handleChunkMetadata(message)
                break
            case "complete":
                this.#handleTransferComplete(message.transferId)
                break
        }
    }

    #handleTransferStart(message: BinaryStartMessage): void {
        const transfer: BinaryTransfer = {
            transferId: message.transferId,
            totalSize: message.totalSize,
            payload: message.payload,
            chunks: [],
            receivedSize: 0,
            expectingChunkData: false,
            onProgress: (progress) => this.#defaultOnProgress(message.transferId, progress),
            onComplete: (data, payload) => this.#defaultOnComplete(message.transferId, data, payload)
        }
        this.#activeTransfers.set(message.transferId, transfer)
        console.debug(`[BinaryNetwork] Started receiving transfer ${message.transferId} (${message.totalSize} bytes) with payload:`, message.payload)
    }

    #handleChunkMetadata(message: BinaryChunkMessage): void {
        const transfer = this.#activeTransfers.get(message.transferId)
        if (isAbsent(transfer)) return

        transfer.expectingChunkData = true
    }

    #handleBinaryChunk(data: Uint8Array): void {
        for (const transfer of this.#activeTransfers.values()) {
            if (transfer.expectingChunkData) {
                transfer.chunks.push(data)
                transfer.receivedSize += data.byteLength
                transfer.expectingChunkData = false
                transfer.onProgress(transfer.receivedSize / transfer.totalSize)
                return
            }
        }

        console.warn(`[BinaryNetwork] Received unexpected binary chunk`)
    }

    #handleTransferComplete(transferId: string): void {
        const transfer = this.#activeTransfers.get(transferId)
        if (isAbsent(transfer)) return

        const completeData = new ArrayBuffer(transfer.totalSize)
        const view = new Uint8Array(completeData)
        let offset = 0
        transfer.chunks.forEach(chunk => {
            view.set(chunk, offset)
            offset += chunk.byteLength
        })

        transfer.onComplete(completeData, transfer.payload)
        this.#activeTransfers.delete(transferId)
    }

    #generateTransferId(): string {
        return `${Date.now()}-${Math.random().toString(36).substring(2)}`
    }

    terminate(): void {
        console.debug("[BinaryNetwork] Terminating binary exchange network")
        this.#subscription.terminate()
        this.#peers.clear()
        this.#activeTransfers.clear()
        this.#peerConnectionListeners.clear()
    }

    getActiveTransferCount(): number {
        return this.#activeTransfers.size
    }

    getPeerCount(): number {
        return this.#peers.size
    }
}