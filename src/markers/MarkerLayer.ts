import L from 'leaflet';
import type { LocationMarker, MapMarker } from './MarkerTypes';

/** Everything the layer needs to know to render one state. */
export interface MarkerLayerState {
    readonly markers: readonly MapMarker[];
    readonly location: LocationMarker | null;
    readonly home: MapMarker | null;
}

/**
 * Renders the markers on the map.
 *
 * The gps marker is attached to the map directly instead of to the layer group:
 * its position and heading change several times per second and recreating the
 * icon on every update would make the arrow flicker.
 */
export class MarkerLayer {
    readonly #group: L.LayerGroup;
    #locationMarker: L.Marker | null = null;

    /**
     * @param map Map the markers are drawn on.
     */
    constructor(private readonly map: L.Map) {
        this.#group = L.layerGroup().addTo(map);
    }

    /**
     * Redraws all markers and the connection lines to the home marker.
     * @param state Markers to render.
     */
    render(state: MarkerLayerState): void {
        this.#group.clearLayers();
        this.renderLocation(state.location);

        for (const marker of state.markers) {
            L.marker([marker.lat, marker.lng], {
                icon: L.divIcon({
                    className: 'custom-marker-icon',
                    html: `<div class="marker-number" style="background:${marker.color}">${marker.id}</div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
            }).addTo(this.#group);
        }

        this.renderHomeLines(state);
    }

    /** Draws a line from the home marker to every other marker. */
    private renderHomeLines(state: MarkerLayerState): void {
        const home = state.home;
        if (!home) return;

        const all: MapMarker[] = state.location ? [state.location, ...state.markers] : [...state.markers];
        for (const marker of all) {
            if (marker.id === home.id) continue;
            L.polyline([[home.lat, home.lng], [marker.lat, marker.lng]], {
                color: marker.color,
                weight: 2,
                opacity: 0.8
            }).addTo(this.#group);
        }
    }

    /**
     * Creates, updates or removes the gps marker.
     * @param location Current gps position or null.
     */
    private renderLocation(location: LocationMarker | null): void {
        if (!location) {
            this.#locationMarker?.remove();
            this.#locationMarker = null;
            return;
        }

        if (this.#locationMarker) {
            this.#locationMarker.setLatLng([location.lat, location.lng]);
            const element = this.#locationMarker.getElement()?.querySelector<HTMLElement>('.custom-marker');
            if (element) element.style.transform = `rotate(${location.angle}deg)`;
            return;
        }

        this.#locationMarker = L.marker([location.lat, location.lng], {
            icon: L.divIcon({
                className: '',
                html: `
                    <div class="custom-marker" style="transform: rotate(${location.angle}deg);">
                        <svg viewBox="0 0 100 100">
                        <path d="M10,90 L50,10 L90,90 L50,70 Z" fill="white"/>
                        </svg>
                    </div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            })
        }).addTo(this.map);
    }
}
