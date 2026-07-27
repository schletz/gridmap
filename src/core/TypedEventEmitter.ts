/**
 * Maps event names to the argument tuple their listeners receive.
 * @example interface Events extends EventArgumentMap { found: [latlng: LatLngTuple] }
 */
export type EventArgumentMap = Record<string, unknown[]>;

/**
 * Internal listener type. The argument list is erased here because the map is
 * only keyed by the event name; the public methods restore the exact tuple.
 */
type AnyListener = (...args: any[]) => void;

/**
 * Small typed publish/subscribe base class. It replaces the untyped
 * `eventHandler` objects of the previous javascript version and allows more than
 * one listener per event.
 * @template TEvents Event map of the deriving class.
 */
export class TypedEventEmitter<TEvents extends EventArgumentMap> {
    readonly #listeners = new Map<keyof TEvents, Set<AnyListener>>();

    /**
     * Registers a listener.
     * @param event Name of the event.
     * @param listener Callback invoked with the arguments of the event.
     * @returns A function that removes the listener again.
     */
    on<TName extends keyof TEvents>(event: TName, listener: (...args: TEvents[TName]) => void): () => void {
        let listeners = this.#listeners.get(event);
        if (!listeners) {
            listeners = new Set();
            this.#listeners.set(event, listeners);
        }
        listeners.add(listener);
        return () => this.off(event, listener);
    }

    /**
     * Removes a previously registered listener.
     * @param event Name of the event.
     * @param listener The exact callback that was registered.
     */
    off<TName extends keyof TEvents>(event: TName, listener: (...args: TEvents[TName]) => void): void {
        this.#listeners.get(event)?.delete(listener);
    }

    /**
     * Notifies all listeners of an event.
     * @param event Name of the event.
     * @param args Arguments passed to the listeners.
     */
    protected emit<TName extends keyof TEvents>(event: TName, ...args: TEvents[TName]): void {
        const listeners = this.#listeners.get(event);
        if (!listeners) return;
        // A copy keeps a listener that unsubscribes itself from breaking the loop.
        for (const listener of [...listeners]) listener(...args);
    }
}
