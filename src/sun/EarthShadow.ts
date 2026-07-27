import type L from 'leaflet';
import { toRadians } from '../core/Geo';
import { MapCanvasOverlay } from '../map/MapCanvasOverlay';
import {
    getDarkLatitudeRanges, getEquatorialPosition,
    MERCATOR_LIMIT, SUNRISE_ALTITUDE, TWILIGHT_ALTITUDE
} from './SolarAstronomy';

/** Width of one scan column in pixels. */
const COLUMN_WIDTH = 2;
/** Colour of the shadow; twilight gets one layer, night gets both. */
const SHADOW_COLOR = 'rgba(0, 6, 30, 0.11)';

/** Rectangle in canvas coordinates as [x, y, width, height]. */
type Rectangle = [number, number, number, number];

/** Linear mapping between container coordinates and geographic coordinates. */
interface LinearProjection {
    /** Longitude in degrees for a container x coordinate. */
    getLng(x: number): number;
    /** Container y coordinate for a latitude in radians. */
    getY(latitude: number): number;
}

/**
 * Darkens the part of the map where the sun is below the horizon.
 *
 * The map is scanned column by column. Within one column the longitude is
 * constant, so the latitudes of the shadow borders can be solved analytically
 * (see getDarkLatitudeRanges). Night and civil twilight are painted with two
 * overlapping levels, which yields the soft border of the terminator without any
 * per pixel calculation.
 */
export class EarthShadow extends MapCanvasOverlay {
    #time: Date | null = null;

    constructor(map: L.Map) {
        super(map, 'earth-shadow', 401);
    }

    /**
     * Sets the moment the shadow is drawn for.
     * @param time Moment of the calculation.
     */
    setTime(time: Date): void {
        this.#time = time;
        this.redraw();
    }

    protected override draw(context: CanvasRenderingContext2D, size: L.Point): void {
        if (!this.#time) return;

        const position = getEquatorialPosition(this.#time);
        const sinDeclination = Math.sin(position.declination);
        const cosDeclination = Math.cos(position.declination);
        const thresholds = [
            Math.sin(toRadians(SUNRISE_ALTITUDE)),
            Math.sin(toRadians(TWILIGHT_ALTITUDE))
        ];

        // Every threshold is painted as one path, so overlapping columns of the same
        // level do not darken each other twice.
        const projection = this.getProjection(size);
        const paths: Rectangle[][] = thresholds.map(() => []);
        for (let x = 0; x < size.x; x += COLUMN_WIDTH) {
            const lng = projection.getLng(x + COLUMN_WIDTH / 2);
            const hourAngle = position.siderealTime + toRadians(lng) - position.rightAscension;
            const meridianFactor = cosDeclination * Math.cos(hourAngle);

            thresholds.forEach((threshold, level) => {
                const ranges = getDarkLatitudeRanges(threshold, sinDeclination, meridianFactor);
                for (const range of ranges) {
                    const rectangle = this.getRectangle(x, range, size, projection);
                    if (rectangle) paths[level]!.push(rectangle);
                }
            });
        }

        context.fillStyle = SHADOW_COLOR;
        for (const path of paths) {
            context.beginPath();
            for (const rectangle of path) context.rect(rectangle[0], rectangle[1], rectangle[2], rectangle[3]);
            context.fill();
        }
    }

    /**
     * Linear mapping between container coordinates and geographic coordinates.
     * In the web mercator projection the longitude is linear in x and the mercator
     * latitude is linear in y, so two reference points replace one projection call
     * per scan column.
     * @param size Size of the map container.
     */
    private getProjection(size: L.Point): LinearProjection {
        const west = this.map.containerPointToLatLng([0, 0]).lng;
        const east = this.map.containerPointToLatLng([size.x, 0]).lng;
        const equator = this.map.latLngToContainerPoint([0, west]).y;
        const scale = (this.map.latLngToContainerPoint([45, west]).y - equator)
            / Math.log(Math.tan(Math.PI / 4 + Math.PI / 8));

        return {
            getLng: (x) => west + (east - west) * x / size.x,
            getY: (latitude) => equator + scale * Math.log(Math.tan(Math.PI / 4 + latitude / 2))
        };
    }

    /**
     * Converts a latitude range of one column into a canvas rectangle.
     * @param x Left border of the column in pixels.
     * @param range Latitude range [south, north] in radians.
     * @param size Size of the map container.
     * @param projection Projection as returned by getProjection().
     * @returns Rectangle or null if it is not visible.
     */
    private getRectangle(
        x: number, range: readonly [number, number], size: L.Point, projection: LinearProjection
    ): Rectangle | null {
        const limit = toRadians(MERCATOR_LIMIT);
        const south = Math.max(range[0], -limit);
        const north = Math.min(range[1], limit);
        if (north <= south) return null;

        const top = Math.max(0, Math.floor(projection.getY(north)));
        const bottom = Math.min(size.y, Math.ceil(projection.getY(south)));
        if (bottom <= top) return null;

        return [x, top, COLUMN_WIDTH, bottom - top];
    }
}
