import L from 'leaflet';
import { EARTH_RADIUS, toRadians, type LatLngTuple } from '../core/Geo';

/**
 * Labels of the distance circles.
 *
 * A label is only useful where the user can actually see the corresponding
 * circle line, so every radius is labelled twice on the meridian of the centre
 * and twice where the circle crosses the upper border of the view.
 */
export class DistanceCircleLabels {
    readonly #group: L.LayerGroup;

    /**
     * @param map Map the labels are drawn on.
     */
    constructor(private readonly map: L.Map) {
        this.#group = L.layerGroup().addTo(map);
    }

    /** Removes all labels. */
    clear(): void {
        this.#group.clearLayers();
    }

    /**
     * Redraws the labels of all currently visible circles.
     * @param center Centre of the circles.
     * @param radii Radii of the visible circles in metres.
     */
    draw(center: LatLngTuple, radii: readonly number[]): void {
        this.clear();
        const bounds = this.map.getBounds();
        const north = bounds.getNorth();
        const south = bounds.getSouth();
        const west = bounds.getWest();
        const east = bounds.getEast();
        const centerLatRad = toRadians(center[0]);
        const centerLngRad = toRadians(center[1]);
        const centerLngVisible = center[1] >= west && center[1] <= east;

        for (const radius of radii) {
            const box = this.getBoundingBox(center, radius);
            if (centerLngVisible) {
                for (const lat of [box.north, box.south]) {
                    if (lat <= north && lat >= south) this.addLabel([lat, center[1]], radius, 0);
                }
            }

            // Longitudes where the circle crosses the northern border of the view.
            const angularRadius = radius / EARTH_RADIUS;
            const viewLatRad = toRadians(north);
            const cosHourAngle = (Math.cos(angularRadius) - Math.sin(centerLatRad) * Math.sin(viewLatRad))
                / (Math.cos(centerLatRad) * Math.cos(viewLatRad));
            if (Math.abs(cosHourAngle) > 1) continue;

            const offset = Math.acos(cosHourAngle);
            this.addLabel([north, (centerLngRad + offset) * 180 / Math.PI], radius, 10);
            this.addLabel([north, (centerLngRad - offset) * 180 / Math.PI], radius, 10);
        }
    }

    /**
     * Bounding box of a circle in geographic coordinates.
     * @param center Centre of the circle.
     * @param radius Radius in metres.
     */
    private getBoundingBox(center: LatLngTuple, radius: number): { north: number; south: number } {
        const deltaLat = (radius / EARTH_RADIUS) * 180 / Math.PI;
        return { north: center[0] + deltaLat, south: center[0] - deltaLat };
    }

    /**
     * Adds a single radius label.
     * @param latlng Anchor of the label.
     * @param radius Radius in metres.
     * @param marginTop Vertical offset in pixels.
     */
    private addLabel(latlng: LatLngTuple, radius: number, marginTop: number): void {
        const text = radius >= 1000 ? `${radius / 1000}km` : `${radius}m`;
        L.marker([latlng[0], latlng[1]], {
            interactive: false,
            icon: L.divIcon({
                className: 'distance-label',
                html: `<div style="margin-top:${marginTop}px;">${text}</div>`,
                iconSize: [30, 12],
                iconAnchor: [15, 6]
            })
        }).addTo(this.#group);
    }
}
