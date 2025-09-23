import {
    asDefined,
    assert,
    EmptyExec,
    Errors,
    JSONValue,
    Option,
    panic,
    RuntimeNotifier,
    Subscription,
    Terminable,
    Terminator,
    UUID
} from "@opendaw/lib-std"
import {ArrayField, BoxGraph, Field, ObjectField, PointerField, PrimitiveField, Update} from "@opendaw/lib-box"
import {LiveblocksYjsProvider} from "@liveblocks/yjs"
import * as Y from "yjs"
import {Utils} from "./Utils"
import {Project} from "@opendaw/studio-core"
import {BoxIO} from "@opendaw/studio-boxes"
import {ProjectDecoder} from "@opendaw/studio-adapters"
import {StudioService} from "@/service/StudioService"

const boxesMapKey = "y-boxes"

type EventHandler = (events: Array<Y.YEvent<any>>, transaction: Y.Transaction) => void

export class LiveblocksSync<T> implements Terminable {
    static async getOrCreate(service: StudioService, provider: LiveblocksYjsProvider, roomName: string): Promise<void> {
        console.debug("getOrCreate", roomName)
        const doc: Y.Doc = provider.getYDoc()
        await new Promise<void>((resolve) => {
            if (provider.synced) {
                resolve()
            } else {
                provider.on("synced", resolve)
            }
        })
        const boxesMap = doc.getMap(boxesMapKey)
        const isRoomEmpty = boxesMap.size === 0
        if (isRoomEmpty) {
            if (!service.hasProfile) {
                await service.cleanSlate()
            }
            const project = service.project
            const sync = await this.populate(project.boxGraph, provider)
            project.own(sync)
            project.own(Terminable.create(() => console.debug("TERMINATE")))
            project.editing.disable()
        } else {
            if (service.hasProfile) {
                const approved = await RuntimeNotifier.approve({
                    headline: "Room Already Exists",
                    message: "Do you want to join it?",
                    approveText: "Join",
                    cancelText: "Cancel"
                })
                if (!approved) {
                    return Promise.reject(Errors.AbortError)
                }
            }
            const boxGraph = new BoxGraph<BoxIO.TypeMap>(Option.wrap(BoxIO.create))
            const sync = await this.join(boxGraph, provider)
            const project = Project.skeleton(service, {
                boxGraph,
                mandatoryBoxes: ProjectDecoder.findMandatoryBoxes(boxGraph)
            })
            project.own(sync)
            project.editing.disable()
            service.fromProject(project, roomName)
        }
    }

    static async populate<T>(boxGraph: BoxGraph<T>, provider: LiveblocksYjsProvider): Promise<LiveblocksSync<T>> {
        console.debug("populate")
        const doc: Y.Doc = provider.getYDoc()
        const boxesMap = doc.getMap(boxesMapKey)
        assert(boxesMap.size === 0, "BoxesMap must be empty")
        const sync = new LiveblocksSync<T>(boxGraph, doc)
        doc.transact(() => boxGraph.boxes().forEach(box => {
            const key = UUID.toString(box.address.uuid)
            const map = Utils.createBoxMap(box)
            boxesMap.set(key, map)
        }), "populate")
        return sync
    }

    static async join<T>(boxGraph: BoxGraph<T>, provider: LiveblocksYjsProvider): Promise<LiveblocksSync<T>> {
        console.debug("join")
        assert(boxGraph.boxes().length === 0, "BoxGraph must be empty")
        const doc: Y.Doc = provider.getYDoc()
        const sync = new LiveblocksSync<T>(boxGraph, doc)
        sync.#boxGraph.beginTransaction()
        const boxesMap: Y.Map<unknown> = doc.getMap(boxesMapKey)
        boxesMap.forEach((value, key) => {
            const boxMap = value as Y.Map<any>
            const uuid = UUID.parse(key)
            const name = boxMap.get("name") as keyof T
            const fields = boxMap.get("fields") as Y.Map<unknown>
            boxGraph.createBox(name, uuid, box => Utils.applyFromBoxMap(box, fields))
        })
        sync.#boxGraph.endTransaction()
        sync.#boxGraph.verifyPointers()
        return sync
    }

    readonly #terminator = new Terminator()

    readonly #boxGraph: BoxGraph<T>
    readonly #doc: Y.Doc
    readonly #boxesMap: Y.Map<unknown>
    readonly #updates: Array<Update>

    #ignoreUpdates: boolean = false

    constructor(boxGraph: BoxGraph<T>, doc: Y.Doc) {
        this.#boxGraph = boxGraph
        this.#doc = doc
        this.#boxesMap = doc.getMap(boxesMapKey)
        this.#updates = []
        this.#terminator.ownAll(this.#setupYjs(), this.#setupOpenDAW())
    }

    terminate(): void {this.#terminator.terminate()}

    #setupYjs(): Subscription {
        const eventHandler: EventHandler = (events, transaction) => {
            console.debug("got updates", transaction.origin)
            if (transaction.local) {
                console.debug("Skip local update")
                return
            }
            this.#boxGraph.beginTransaction()
            events.forEach(event => {
                const path = event.path
                const keys = event.changes.keys
                keys.entries().forEach(([key, change]: [string, {
                    action: "add" | "delete" | "update",
                    oldValue: any
                }]) => {
                    if (change.action === "add") {
                        assert(path.length === 0, "Add cannot have a path")
                        const boxMap = this.#boxesMap.get(key) as Y.Map<unknown>
                        const name = boxMap.get("name") as keyof T
                        const fields = boxMap.get("fields") as Y.Map<unknown>
                        const uuid = UUID.parse(key)
                        this.#boxGraph.createBox(name, uuid, box => Utils.applyFromBoxMap(box, fields))
                    } else if (change.action === "update") {
                        if (path.length === 0) {
                            console.debug("Mystery update - Box:", key)
                            console.debug("Old value:", change.oldValue)
                            console.debug("New value:", this.#boxesMap.get(key))
                            console.debug("Are they equal?", change.oldValue === this.#boxesMap.get(key))
                            console.debug("Transaction origin:", transaction.origin)
                            return
                        }
                        // TODO resolve map and field (object or array) once and use it for all changes (optimization)
                        this.#updateValue(path, key)
                    } else if (change.action === "delete") {
                        assert(path.length === 0, "Delete cannot have a path")
                        const remove = this.#boxGraph.findBox(UUID.parse(key))
                            .unwrap("Could not find box to delete")
                        const {pointers} = this.#boxGraph.dependenciesOf(remove)
                        for (const pointer of pointers) {
                            console.warn(`Deleting box ${remove} while it is referenced by ${pointer}.`)
                            pointer.defer()
                        }
                        this.#boxGraph.unstageBox(remove)
                    }
                })
            })
            this.#ignoreUpdates = true
            this.#boxGraph.endTransaction()
            // TODO This is the place where we should check for invalid high-level conflicts and revert the transaction.
            //  We need to store all updates in BoxGraph and have an API to rollback any transaction.
            this.#boxGraph.verifyPointers()
            this.#ignoreUpdates = false
        }
        this.#boxesMap.observeDeep(eventHandler)
        return {terminate: () => {this.#boxesMap.unobserveDeep(eventHandler)}}
    }

    #updateValue([uuidAsString, fieldsKey, ...fieldKeys]: ReadonlyArray<string | number>, key: string): void {
        uuidAsString = String(uuidAsString)
        const uuid = UUID.parse(uuidAsString)
        const boxMap = this.#boxesMap.get(uuidAsString) as Y.Map<unknown>
        const fields = boxMap.get(String(fieldsKey)) as Y.Map<unknown>
        const box = this.#boxGraph.findBox(uuid).unwrap("Could not find box")
        const targetMap = Utils.findMap(fields, fieldKeys)
        const vertexOption = box.searchVertex(Utils.pathKeyToFieldKeys(fieldKeys, key))
        vertexOption.unwrap("Could not find field").accept({
            visitField: (_: Field) => panic("Vertex must be either Primitive or Pointer"),
            visitArrayField: (_: ArrayField) => panic("Vertex must be either Primitive or Pointer"),
            visitObjectField: (_: ObjectField<any>) => panic("Vertex must be either Primitive or Pointer"),
            visitPointerField: (field: PointerField) => field.fromJSON(targetMap.get(key) as JSONValue),
            visitPrimitiveField: (field: PrimitiveField) => field.fromJSON(targetMap.get(key) as JSONValue)
        })
    }

    #setupOpenDAW(): Terminable {
        return Terminable.many(
            this.#boxGraph.subscribeTransaction({
                onBeginTransaction: EmptyExec,
                onEndTransaction: () => {
                    if (this.#ignoreUpdates) {
                        this.#updates.length = 0
                        return
                    }
                    this.#doc.transact(() => this.#updates.forEach(update => {
                        console.debug(update)
                        /**
                         * TRANSFER CHANGES FROM OPENDAW TO LIVEBLOCKS
                         */
                        if (update.type === "new") {
                            const uuid = update.uuid
                            const key = UUID.toString(uuid)
                            const box = this.#boxGraph.findBox(uuid).unwrap()
                            this.#boxesMap.set(key, Utils.createBoxMap(box))
                        } else if (update.type === "primitive") {
                            const key = UUID.toString(update.address.uuid)
                            const boxObject = asDefined(this.#boxesMap.get(key),
                                "Could not find box") as Y.Map<unknown>
                            const {address: {fieldKeys}, newValue} = update
                            console.debug("P", boxObject, fieldKeys, newValue)
                            let field = boxObject.get("fields") as Y.Map<unknown>
                            for (let i = 0; i < fieldKeys.length - 1; i++) {
                                field = asDefined(field.get(String(fieldKeys[i])),
                                    `No field at '${fieldKeys[i]}'`) as Y.Map<unknown>
                            }
                            field.set(String(fieldKeys[fieldKeys.length - 1]), newValue)
                        } else if (update.type === "pointer") {
                            const key = UUID.toString(update.address.uuid)
                            const boxObject = asDefined(this.#boxesMap.get(key),
                                "Could not find box") as Y.Map<unknown>
                            const {address: {fieldKeys}, newAddress} = update
                            let field = boxObject.get("fields") as Y.Map<unknown>
                            for (let i = 0; i < fieldKeys.length - 1; i++) {
                                field = asDefined(field.get(String(fieldKeys[i])),
                                    `No field at '${fieldKeys[i]}'`) as Y.Map<unknown>
                            }
                            field.set(String(fieldKeys[fieldKeys.length - 1]),
                                newAddress.mapOr(address => address.toString(), null))
                        } else if (update.type === "delete") {
                            this.#boxesMap.delete(UUID.toString(update.uuid))
                        }
                    }), "openDAW")
                    this.#updates.length = 0
                }
            }),
            this.#boxGraph.subscribeToAllUpdatesImmediate({
                onUpdate: (update: Update): unknown => this.#updates.push(update)
            })
        )
    }
}