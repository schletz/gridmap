import type { LatLngTuple } from '../core/Geo';
import { TypedEventEmitter } from '../core/TypedEventEmitter';

interface GeolocationTrackerEvents extends Record<string, unknown[]> {
    /** A new position was accepted. `first` marks the first fix after switching on. */
    positionchanged: [latlng: LatLngTuple, first: boolean];
    /** Tracking was switched off or could not be started. */
    stopped: [];
    /** The browser reported an error. */
    failed: [message: string];
}

/** Minimum time between two accepted positions in milliseconds. */
const UPDATE_INTERVAL = 500;

/**
 * Watches the gps position of the device.
 *
 * Position updates are throttled and are dropped completely while the user pans
 * or zooms, because moving the map under a moving marker fights the user's own
 * gesture.
 */
export class GeolocationTracker extends TypedEventEmitter<GeolocationTrackerEvents> {
    #watchId: number | null = null;
    #lastUpdate = 0;

    /**
     * @param shouldIgnore Returns true while position updates must be dropped.
     */
    constructor(private readonly shouldIgnore: () => boolean) {
        super();
    }

    /** True while the tracker is running. */
    get active(): boolean {
        return this.#watchId !== null;
    }

    /**
     * Starts watching the position.
     * @returns False if the browser does not support geolocation.
     */
    start(): boolean {
        if (this.active) return true;
        if (!navigator.geolocation) {
            this.emit('failed', 'Geolocation wird nicht unterstützt.');
            return false;
        }

        this.#lastUpdate = 0;
        this.#watchId = navigator.geolocation.watchPosition(
            (position) => this.handle(position),
            (error) => this.emit('failed', error.message),
            { enableHighAccuracy: true }
        );
        return true;
    }

    /** Stops watching the position. */
    stop(): void {
        if (this.#watchId !== null) {
            navigator.geolocation.clearWatch(this.#watchId);
            this.#watchId = null;
        }
        this.#lastUpdate = 0;
        this.emit('stopped');
    }

    /** Starts or stops the tracker and returns the new state. */
    toggle(): boolean {
        if (this.active) {
            this.stop();
            return false;
        }
        return this.start();
    }

    private handle(position: GeolocationPosition): void {
        if (this.shouldIgnore()) return;
        const now = Date.now();
        if (now - this.#lastUpdate < UPDATE_INTERVAL) return;

        const first = this.#lastUpdate === 0;
        this.#lastUpdate = now;
        this.emit('positionchanged', [position.coords.latitude, position.coords.longitude], first);
    }
}
