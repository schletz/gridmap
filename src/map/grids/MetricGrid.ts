import L from 'leaflet';
import { GRID_LINE_STYLE, MapGrid } from './MapGrid';

/** Below this zoom level a metric grid would produce far too many lines. */
const MIN_ZOOM = 3;

/**
 * Grid of equidistant lines with a spacing given in metres. The lines are laid
 * out in the spherical mercator plane starting at the centre of the view, so the
 * spacing is exact at the centre latitude and grows towards the poles like the
 * projection itself.
 */
export class MetricGrid extends MapGrid {
    /**
     * @param spacingMeters Grid spacing in metres.
     */
    constructor(spacingMeters = 1000) {
        super(spacingMeters);
    }

    protected override createLayers(map: L.Map, bounds: L.LatLngBounds): L.Layer[] {
        if (map.getZoom() < MIN_ZOOM) return [];

        const center = map.getCenter();
        // Mercator distances are stretched by 1/cos(latitude) against real distances.
        const step = this.spacing / Math.abs(Math.cos(center.lat * Math.PI / 180));
        const centerPoint = this.project(center);
        const southWest = this.project(bounds.getSouthWest());
        const northEast = this.project(bounds.getNorthEast());

        const layers: L.Layer[] = [];
        for (const y of this.getOffsets(centerPoint.y, step, southWest.y, northEast.y)) {
            layers.push(L.polyline(
                [this.unproject(southWest.x, y), this.unproject(northEast.x, y)], GRID_LINE_STYLE));
        }
        for (const x of this.getOffsets(centerPoint.x, step, southWest.x, northEast.x)) {
            layers.push(L.polyline(
                [this.unproject(x, northEast.y), this.unproject(x, southWest.y)], GRID_LINE_STYLE));
        }
        return layers;
    }

    /**
     * Grid positions on one axis, starting at the centre and growing outwards in
     * both directions until the view is covered.
     * @param center Position of the centre line.
     * @param step Distance between two lines.
     * @param min Lower border of the view on this axis.
     * @param max Upper border of the view on this axis.
     */
    private getOffsets(center: number, step: number, min: number, max: number): number[] {
        const positions = [center];
        for (let offset = step; center + offset < max || center - offset > min; offset += step) {
            if (center + offset < max) positions.push(center + offset);
            if (center - offset > min) positions.push(center - offset);
        }
        return positions;
    }

    private project(latlng: L.LatLng): L.Point {
        return L.Projection.SphericalMercator.project(latlng);
    }

    private unproject(x: number, y: number): L.LatLng {
        return L.Projection.SphericalMercator.unproject(L.point(x, y));
    }
}
