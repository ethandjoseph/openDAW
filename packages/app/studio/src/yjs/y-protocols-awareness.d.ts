// types/y-protocols-awareness.d.ts
declare module "y-protocols/awareness.js" {
    import type * as Y from 'yjs';

    // Client metadata stored alongside awareness state
    export interface MetaClientState {
        clock: number;
        lastUpdated: number;
    }

    // Event payload for awareness changes
    export interface AwarenessChanges {
        added: number[]; // Array of newly added client IDs
        updated: number[]; // Array of client IDs that had their state updated
        removed: number[]; // Array of client IDs that were removed/went offline
    }

    // Generic awareness state - can contain any JSON-serializable data
    // Common patterns include cursor position, user info, selection state, etc.
    export type AwarenessState = Record<string, any> | null;

    // The Awareness class implements a simple network agnostic protocol
    // to propagate awareness information like cursor, username, or status.
    // Each client can update its own local state and listen to state changes of remote clients.
    export class Awareness {
        // Create a new awareness instance
        constructor(doc: Y.Doc);

        // A unique identifier that identifies this client. Usually matches doc.clientID
        readonly clientID: number;

        // The Yjs document this awareness instance is associated with
        readonly doc: Y.Doc;

        // Map from client ID to awareness state for all known clients (including local)
        readonly states: Map<number, AwarenessState>;

        // Map from client ID to metadata (clock and lastUpdated timestamp)
        readonly meta: Map<number, MetaClientState>;

        // Get the local awareness state
        getLocalState(): AwarenessState;

        // Set/Update the local awareness state. Set null to mark client as offline
        setLocalState(state: AwarenessState): void;

        // Only update a single field on the local awareness object
        // Does not do anything if the local state is not set
        setLocalStateField(field: string, value: any): void;

        // Get all client awareness states (remote and local)
        // Maps from clientID to awareness state
        getStates(): Map<number, AwarenessState>;

        // Listen to remote and local awareness changes
        // This event is called even when the awareness state does not change
        // but is only updated to notify other users that this client is still online.
        // Use this event if you want to propagate awareness state to other users.
        on(
            eventType: 'update',
            callback: (changes: AwarenessChanges, origin?: any) => void
        ): void;

        // Listen to remote and local state changes
        // Get notified when a state is either added, updated, or removed
        on(
            eventType: 'change',
            callback: (changes: AwarenessChanges, origin?: any) => void
        ): void;

        // Remove event listener
        off(
            eventType: 'update' | 'change',
            callback: (changes: AwarenessChanges, origin?: any) => void
        ): void;

        // Destroy this awareness instance and clean up resources
        destroy(): void;
    }

    // Constant defining the timeout (in milliseconds) after which a client
    // is considered offline if no updates are received
    export const outdatedTimeout: 30000;

    // Encode the awareness states of the specified clients into an update encoded as Uint8Array
    export function encodeAwarenessUpdate(
        awareness: Awareness,
        clients?: number[]
    ): Uint8Array;

    // Apply an awareness update created with encodeAwarenessUpdate to an instance of the Awareness CRDT
    export function applyAwarenessUpdate(
        awareness: Awareness,
        update: Uint8Array,
        origin?: any
    ): void;

    // Remove the awareness states of the specified clients
    // This will call the update and the change event handler of the Awareness CRDT.
    // Sometimes you want to mark yourself or others as offline. As soon as you know
    // that a client is offline, you should call this function.
    export function removeAwarenessStates(
        awareness: Awareness,
        clients: number[],
        origin?: any
    ): void;
}

// Optional: Export types for easier use
export type {
    MetaClientState,
    AwarenessChanges,
    AwarenessState
} from "y-protocols/awareness.js";