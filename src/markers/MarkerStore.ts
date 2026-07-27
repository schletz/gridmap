import type { LatLngTuple } from '../core/Geo';
import { TypedEventEmitter } from '../core/TypedEventEmitter';
import { MARKER_COLORS, type MapMarker } from './MarkerTypes';
import { MARKER_QUERY_PARAMETER, MarkerUrlCodec } from './MarkerUrlCodec';

interface MarkerStoreEvents extends Record<string, unknown[]> {
    /** The marker set changed and has already been persisted. */
    changed: [markers: readonly MapMarker[]];
}

/** Key of the marker set in the local storage. */
const STORAGE_KEY = 'customMarkers';

/**
 * Persistent set of user defined markers.
 *
 * The store is the single owner of the marker data; the map layer and the marker
 * list only render what it publishes. Every change is written to the local
 * storage immediately, so a reload restores the last state.
 */
export class MarkerStore extends TypedEventEmitter<MarkerStoreEvents> {
    #markers: MapMarker[] = [];

    constructor() {
        super();
        this.#markers = this.read();
    }

    /** All markers, sorted by id. */
    get markers(): readonly MapMarker[] {
        return this.#markers;
    }

    /**
     * Adds a marker at the given position. It receives the lowest free id and the
     * colour belonging to that id.
     * @param latlng Position of the new marker.
     */
    add(latlng: LatLngTuple): MapMarker {
        let id = 1;
        for (const marker of this.#markers) {
            if (marker.id !== id) break;
            id++;
        }
        const marker: MapMarker = {
            id,
            lat: latlng[0],
            lng: latlng[1],
            color: MARKER_COLORS[(id - 1) % MARKER_COLORS.length]!
        };
        this.#markers = [...this.#markers, marker].sort((first, second) => first.id - second.id);
        this.write();
        return marker;
    }

    /**
     * Removes a marker.
     * @param id Id of the marker.
     */
    remove(id: number): void {
        this.#markers = this.#markers.filter(marker => marker.id !== id);
        this.write();
    }

    /** Removes all markers, including the persisted copy. */
    clear(): void {
        this.#markers = [];
        localStorage.removeItem(STORAGE_KEY);
        this.emit('changed', this.#markers);
    }

    /**
     * Takes over a marker set from the query string of the current url.
     * @returns True if the url contained a marker set.
     */
    loadFromQueryString(): boolean {
        const parameters = new URLSearchParams(window.location.search);
        const data = parameters.get(MARKER_QUERY_PARAMETER);
        if (data === null) return false;

        this.#markers = MarkerUrlCodec.decode(data);
        this.write();
        return true;
    }

    /** Encodes the current marker set for the QR code export. */
    encodeForUrl(): string {
        return MarkerUrlCodec.encode(this.#markers);
    }

    /** Reads the persisted markers, tolerating a corrupted storage entry. */
    private read(): MapMarker[] {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            const parsed: unknown = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter((marker): marker is MapMarker =>
                typeof marker === 'object' && marker !== null
                && Number.isFinite((marker as MapMarker).id)
                && Number.isFinite((marker as MapMarker).lat)
                && Number.isFinite((marker as MapMarker).lng));
        } catch {
            return [];
        }
    }

    private write(): void {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#markers));
        this.emit('changed', this.#markers);
    }
}
