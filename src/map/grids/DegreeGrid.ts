import L from 'leaflet';
import { GRID_LINE_STYLE, MapGrid } from './MapGrid';

/**
 * Grid of meridians and parallels. The spacing is given in arc seconds, which
 * covers every step of the menu from 10° down to 1".
 */
export class DegreeGrid extends MapGrid {
    /**
     * @param spacingSeconds Grid spacing in arc seconds.
     */
    constructor(spacingSeconds = 3600) {
        super(spacingSeconds);
    }

    protected override createLayers(map: L.Map, bounds: L.LatLngBounds): L.Layer[] {
        const step = this.spacing / 3600;
        const layers: L.Layer[] = [];
        // The labels are kept slightly inside the view so they stay readable.
        const labelBounds = map.getBounds().pad(-0.03);
        const west = bounds.getWest();
        const east = bounds.getEast();
        const south = bounds.getSouth();
        const north = bounds.getNorth();

        for (let lat = this.snap(south, step); lat < north; lat += step) {
            layers.push(L.polyline([[lat, west], [lat, east]], GRID_LINE_STYLE));
            layers.push(this.createLabel([lat, labelBounds.getWest()], this.formatCoordinate(lat, 'lat'), 'lat'));
        }
        for (let lng = this.snap(west, step); lng < east; lng += step) {
            layers.push(L.polyline([[north, lng], [south, lng]], GRID_LINE_STYLE));
            layers.push(this.createLabel([labelBounds.getSouth(), lng], this.formatCoordinate(lng, 'lng'), 'lng'));
        }
        return layers;
    }

    /** Rounds a coordinate down to the next grid line. */
    private snap(value: number, step: number): number {
        return Math.floor(value / step) * step;
    }

    /**
     * Formats a coordinate as degrees, minutes and seconds. Parts that are zero
     * are omitted, so a full degree stays a short "13°E".
     * @param coordinate Coordinate in degrees.
     * @param direction Axis the coordinate belongs to.
     */
    private formatCoordinate(coordinate: number, direction: 'lat' | 'lng'): string {
        let value = coordinate;
        if (value < -180) value += 360;
        if (value >= 180) value -= 360;

        const totalSeconds = Math.round(Math.abs(value) * 3600);
        const degrees = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds - 3600 * degrees) / 60);
        const seconds = totalSeconds - 3600 * degrees - 60 * minutes;

        let label = `${degrees}°`;
        if (minutes !== 0 || seconds !== 0) label += `${minutes}'`;
        if (seconds !== 0) label += `${seconds}"`;
        if (direction === 'lat') return label + (value < 0 ? 'S' : 'N');
        return label + (value < 0 ? 'W' : 'E');
    }
}
