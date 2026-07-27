import L from 'leaflet';
import type { LatLngTuple } from '../core/Geo';
import { DistanceCircleLabels } from './DistanceCircleLabels';

/** Circle spacing that is used from a given zoom level upwards. */
export interface DistanceCircleStep {
    /** Distance between two circles in metres. */
    readonly step: number;
    /** Lowest zoom level this spacing is used for. */
    readonly minZoom: number;
}

export interface DistanceCircleOptions {
    /** Spacings ordered from the finest to the coarsest one. */
    readonly steps: readonly DistanceCircleStep[];
    /** True to draw the radius labels. */
    readonly labels: boolean;
}

/** Every fifth circle is drawn with a thicker line. */
const EMPHASIS_INTERVAL = 5;

/**
 * Concentric distance circles around a centre point.
 *
 * Only the circles that can actually intersect the current view are created,
 * which keeps the number of leaflet layers low even at low zoom levels. The
 * class replaces the `L.Map.prototype` extensions of the previous version so the
 * map object stays untouched.
 */
export class DistanceCircleOverlay {
    readonly #circleGroup: L.LayerGroup;
    readonly #labels: DistanceCircleLabels | null;
    readonly #steps: readonly DistanceCircleStep[];
    #center: LatLngTuple | null = null;
    #color = '#007bff';
    #enabled = true;

    /**
     * @param map Map the circles are drawn on.
     * @param options Spacings per zoom level and label switch.
     */
    constructor(private readonly map: L.Map, options: DistanceCircleOptions) {
        this.#steps = options.steps;
        this.#circleGroup = L.layerGroup().addTo(map);
        this.#labels = options.labels ? new DistanceCircleLabels(map) : null;

        map.on('zoomend moveend', () => this.draw());
    }

    /**
     * Sets the centre of the circles and draws them.
     * @param center Centre position.
     * @param color Line colour, defaults to the colour of the location marker.
     */
    setCenter(center: LatLngTuple, color?: string): void {
        this.#center = center;
        this.#color = color ?? '#007bff';
        this.draw();
    }

    /** Removes the circles and forgets the centre. */
    clear(): void {
        this.#circleGroup.clearLayers();
        this.#labels?.clear();
        this.#center = null;
    }

    /**
     * Hides or shows the circles without losing the centre, so other features
     * (the sun path) can free the map and restore it afterwards.
     * @param enabled True to draw the circles.
     */
    setEnabled(enabled: boolean): void {
        this.#enabled = enabled;
        this.draw();
    }

    /** Rebuilds all circles for the current view. */
    draw(): void {
        const center = this.#center;
        if (!center) return;
        if (!this.#enabled) {
            this.#circleGroup.clearLayers();
            this.#labels?.clear();
            return;
        }

        const step = this.#steps.find(candidate => candidate.minZoom <= this.map.getZoom())?.step;
        if (!step) return;

        this.#circleGroup.clearLayers();
        const radii: number[] = [];
        const range = this.getVisibleRadiusRange(center, step);
        for (let radius = range.min; radius <= range.max; radius += step) {
            L.circle([center[0], center[1]], {
                radius,
                color: this.#color,
                weight: radius % (EMPHASIS_INTERVAL * step) === 0 ? 2 : 1,
                fillOpacity: 0,
                interactive: false
            }).addTo(this.#circleGroup);
            radii.push(radius);
        }
        this.#labels?.draw(center, radii);
    }

    /**
     * Smallest and largest radius that can be seen in the current view.
     *
     * If the centre lies inside the view every circle up to the farthest corner
     * is visible. Otherwise all circles smaller than the distance to the nearest
     * point of the view are completely off screen and can be skipped.
     * @param center Centre of the circles.
     * @param step Distance between two circles in metres.
     */
    private getVisibleRadiusRange(center: LatLngTuple, step: number): { min: number; max: number } {
        const bounds = this.map.getBounds();
        const north = bounds.getNorth();
        const south = bounds.getSouth();
        const west = bounds.getWest();
        const east = bounds.getEast();

        const max = Math.max(
            this.map.distance([center[0], center[1]], [north, west]),
            this.map.distance([center[0], center[1]], [north, east]),
            this.map.distance([center[0], center[1]], [south, east]),
            this.map.distance([center[0], center[1]], [south, west])
        );

        const centerIsOnMap = center[0] <= north && center[0] >= south && center[1] <= east && center[1] >= west;
        if (centerIsOnMap) return { min: step, max };

        const nearest = this.getNearestEdgePoint(center, north, west, south, east);
        const minDistance = this.map.distance([center[0], center[1]], nearest);
        return { min: Math.floor(minDistance / step) * step, max };
    }

    /**
     * Point of the view rectangle that is closest to a centre outside of it.
     * @param center Centre of the circles.
     * @param north Northern border of the view.
     * @param west Western border of the view.
     * @param south Southern border of the view.
     * @param east Eastern border of the view.
     */
    private getNearestEdgePoint(
        center: LatLngTuple, north: number, west: number, south: number, east: number
    ): [number, number] {
        const lat = Math.min(north, Math.max(south, center[0]));
        const lng = Math.min(east, Math.max(west, center[1]));
        return [lat, lng];
    }
}
