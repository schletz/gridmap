import type L from 'leaflet';
import type { LatLngTuple } from '../core/Geo';
import { TypedEventEmitter } from '../core/TypedEventEmitter';
import { MarkerLayer, type MarkerLayerState } from './MarkerLayer';
import { MarkerListView } from './MarkerListView';
import { MarkerStore } from './MarkerStore';
import { LOCATION_COLOR, type LocationMarker, type MapMarker } from './MarkerTypes';

/** Elements the marker feature renders into. */
export interface MarkerElements {
    /** Container of the marker table. */
    readonly table: HTMLElement;
    /** Button that deletes all markers. */
    readonly clearButton: HTMLButtonElement;
}

interface MarkerControllerEvents extends Record<string, unknown[]> {
    /** A marker was picked in the list; the map should centre on it. */
    markerselected: [marker: MapMarker];
    /** The home marker changed, was deleted or moved with the gps position. */
    homechanged: [marker: MapMarker | null];
    /** All markers were deleted. */
    clearall: [];
}

/** Delay in milliseconds after which a touch counts as "long press". */
const LONG_PRESS_MS = 600;

/**
 * Ties the marker store, the map layer and the marker table together.
 *
 * It owns the two pieces of state that are not persisted: the current gps
 * position and which marker is the home marker the distances, the connection
 * lines and the sun path refer to.
 */
export class MarkerController extends TypedEventEmitter<MarkerControllerEvents> {
    readonly #store = new MarkerStore();
    readonly #layer: MarkerLayer;
    readonly #list: MarkerListView;
    #location: LocationMarker | null = null;
    #home: MapMarker | null = null;

    /**
     * @param map Map the markers are drawn on.
     * @param elements Elements of the marker menu.
     */
    constructor(private readonly map: L.Map, elements: MarkerElements) {
        super();
        this.#layer = new MarkerLayer(map);
        this.#list = new MarkerListView(elements.table,
            (from, to) => map.distance([from.lat, from.lng], [to.lat, to.lng]));

        this.#store.on('changed', () => this.update());
        this.#list.on('markerselected', (marker) => this.emit('markerselected', marker));
        this.#list.on('homeselected', (marker) => this.setHome(marker));
        this.#list.on('markerdeleted', (id) => this.removeMarker(id));
        this.#list.on('locationadded', (marker) => this.addMarker([marker.lat, marker.lng]));
        elements.clearButton.addEventListener('click', () => this.clear());

        this.bindMapGestures(map);
        this.update();
    }

    /** Encoded marker set for the QR code export. */
    encodeForUrl(): string {
        return this.#store.encodeForUrl();
    }

    /** The current home marker or null. */
    get home(): MapMarker | null {
        return this.#home;
    }

    /**
     * Takes over a marker set from the query string.
     * @returns True if the url contained a marker set.
     */
    loadFromQueryString(): boolean {
        return this.#store.loadFromQueryString();
    }

    /**
     * Adds a marker at the given position.
     * @param latlng Position of the new marker.
     */
    addMarker(latlng: LatLngTuple): void {
        this.#store.add(latlng);
    }

    /**
     * Removes a marker. If it was the home marker, the home is cleared as well.
     * @param id Id of the marker.
     */
    removeMarker(id: number): void {
        if (this.#home?.id === id) this.setHome(null);
        this.#store.remove(id);
    }

    /** Deletes all markers and switches the home marker off. */
    clear(): void {
        this.setHome(null);
        this.#store.clear();
        this.emit('clearall');
    }

    /**
     * Updates the gps position.
     * @param latlng Current position or null when tracking is switched off.
     */
    setLocation(latlng: LatLngTuple | null): void {
        this.#location = latlng
            ? { id: 0, lat: latlng[0], lng: latlng[1], color: LOCATION_COLOR, angle: this.#location?.angle ?? 0 }
            : null;
        // If the gps position is the home marker, the home moves with it.
        if (this.#home?.id === 0) this.setHome(this.#location);
        this.update();
    }

    /**
     * Rotates the arrow of the gps marker.
     * @param heading Heading of the device in degrees.
     */
    setLocationHeading(heading: number): void {
        if (!this.#location) return;
        this.#location = { ...this.#location, angle: heading };
        this.update();
    }

    /**
     * Defines which marker the distances and the sun path refer to.
     * @param marker Marker to use as home, or null to switch the home off.
     */
    setHome(marker: MapMarker | null): void {
        this.#home = marker;
        this.update();
        // Report every change of the home marker, including deletion and gps updates.
        this.emit('homechanged', marker);
    }

    /**
     * Keeps the home marker in the centre when the map area changes size, but
     * only if it is visible; otherwise the view would jump away from the user.
     */
    centerHomeIfInView(): void {
        const home = this.#home;
        if (!home) return;
        if (this.map.getBounds().contains([home.lat, home.lng])) this.map.setView([home.lat, home.lng]);
    }

    /** Redraws the map layer and the marker table. */
    private update(): void {
        const state: MarkerLayerState = {
            markers: this.#store.markers,
            location: this.#location,
            home: this.#home
        };
        this.#layer.render(state);
        this.#list.render(state);
    }

    /** Right click on the desktop and long press on mobile create a marker. */
    private bindMapGestures(map: L.Map): void {
        map.on('contextmenu', (event) => this.addMarker([event.latlng.lat, event.latlng.lng]));

        let touchTimer: number | null = null;
        map.on('touchstart', (event) => {
            const original = (event as L.LeafletEvent & { originalEvent: TouchEvent }).originalEvent;
            if (original.touches.length !== 1) return;
            const touch = original.touches[0]!;
            touchTimer = window.setTimeout(() => {
                const latlng = map.containerPointToLatLng([touch.clientX, touch.clientY]);
                this.addMarker([latlng.lat, latlng.lng]);
            }, LONG_PRESS_MS);
        });
        map.on('touchend', () => {
            if (touchTimer !== null) clearTimeout(touchTimer);
            touchTimer = null;
        });
    }
}
