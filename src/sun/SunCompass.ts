import type L from 'leaflet';
import type { LatLngTuple } from '../core/Geo';
import { MapCanvasOverlay } from '../map/MapCanvasOverlay';
import type { SkyPoint, SolarDayArc, SolarSample } from './SolarAstronomy';

/** Distance in pixels between the bearing circle and the border of the map. */
const PADDING = 30;

const COLORS = {
    circle: 'rgba(40, 50, 70, 0.85)',
    crosshair: 'rgba(40, 50, 70, 0.35)',
    yearRange: 'rgba(255, 200, 0, 0.18)',
    sunrise: '#ffac11',
    sunset: '#d6604a',
    dayArc: '#ffd51e',
    sunRay: '#ffc80a',
    sun: '#fe8008',
    sunBelowHorizon: '#9aa0a6',
    label: '#26324a'
} as const;

/** Direction labels of the bearing circle. */
const DIRECTION_LABELS: readonly { text: string; azimuth: number }[] = [
    { text: 'N', azimuth: 0 },
    { text: 'O', azimuth: Math.PI / 2 },
    { text: 'S', azimuth: Math.PI },
    { text: 'W', azimuth: 3 * Math.PI / 2 }
];

/**
 * Bearing circle ("Peilkreis") with the day arc of the sun, drawn on top of the
 * map around the home location.
 *
 * The sky is mapped orthographically onto the circle: a point with the altitude h
 * is drawn at the distance radius·cos(h) from the centre, so the horizon lies on
 * the circle and the zenith in its centre. The circle keeps a fixed pixel size
 * and is fitted into the map container.
 */
export class SunCompass extends MapCanvasOverlay {
    #center: LatLngTuple | null = null;
    #arc: SolarDayArc | null = null;
    #yearRegions: readonly SolarDayArc[] = [];
    #sun: SolarSample | null = null;

    constructor(map: L.Map) {
        super(map, 'sun-compass', 402);
    }

    /**
     * Sets the location the circle is centred on.
     * @param latlng Home position or null.
     */
    setCenter(latlng: LatLngTuple | null): void {
        this.#center = latlng;
        this.redraw();
    }

    /**
     * Sets the day arc of the selected day.
     * @param arc Segments of the day arc plus the azimuths of sunrise and sunset.
     */
    setDayArc(arc: SolarDayArc): void {
        this.#arc = arc;
        this.redraw();
    }

    /**
     * Sets the two solstice arcs that enclose the range the sun covers over the year.
     * @param regions Day arcs of the June and the December solstice.
     */
    setYearRegions(regions: readonly SolarDayArc[]): void {
        this.#yearRegions = regions;
        this.redraw();
    }

    /**
     * Sets the current position of the sun.
     * @param sun Position in radians.
     */
    setSun(sun: SolarSample): void {
        this.#sun = sun;
        this.redraw();
    }

    protected override draw(context: CanvasRenderingContext2D, size: L.Point): void {
        if (!this.#center) return;

        const center = this.map.latLngToContainerPoint([this.#center[0], this.#center[1]]);
        const radius = Math.min(size.x, size.y) / 2 - PADDING;
        if (radius <= 0) return;

        this.drawYearRange(context, center, radius);
        this.drawCircle(context, center, radius);
        this.drawHorizonLines(context, center, radius);
        this.drawDayArc(context, center, radius);
        this.drawSun(context, center, radius);
        this.drawLabels(context, center, radius);
    }

    /**
     * Converts a sky position into a canvas point.
     * @param center Centre of the circle in container coordinates.
     * @param radius Radius of the circle in pixels.
     * @param azimuth Azimuth clockwise from north in radians.
     * @param altitude Altitude above the horizon in radians; values below the
     *                 horizon are drawn slightly outside the circle.
     */
    private getPoint(center: L.Point, radius: number, azimuth: number, altitude: number): [number, number] {
        const distance = altitude >= 0 ? radius * Math.cos(altitude) : radius + 7;
        return [center.x + Math.sin(azimuth) * distance, center.y - Math.cos(azimuth) * distance];
    }

    /**
     * Fills the area the sun sweeps over the year. Both solstice arcs are added as
     * closed regions "below" the arc; the even-odd rule then fills exactly the area
     * between the June and the December arc, whichever of them runs higher.
     */
    private drawYearRange(context: CanvasRenderingContext2D, center: L.Point, radius: number): void {
        if (this.#yearRegions.length === 0) return;

        context.beginPath();
        for (const region of this.#yearRegions) {
            this.appendRegion(context, region, center, radius);
        }
        context.fillStyle = COLORS.yearRange;
        context.fill('evenodd');
    }

    /**
     * Appends the area between the centre of the circle and one day arc as a closed
     * sub path. Where the sun does not reach a direction on that day the horizon
     * circle is used as the boundary.
     */
    private appendRegion(
        context: CanvasRenderingContext2D, region: SolarDayArc, center: L.Point, radius: number
    ): void {
        if (region.alwaysDown) {
            context.moveTo(center.x + radius, center.y);
            context.arc(center.x, center.y, radius, 0, 2 * Math.PI);
            return;
        }
        const points = this.getLongestSegment(region.segments);
        if (!points) return;

        let turning = 0;
        for (let i = 1; i < points.length; i++) {
            let delta = points[i]!.azimuth - points[i - 1]!.azimuth;
            if (delta > Math.PI) delta -= 2 * Math.PI;
            if (delta < -Math.PI) delta += 2 * Math.PI;
            turning += delta;
        }

        points.forEach((point, index) => {
            const target = this.getPoint(center, radius, point.azimuth, point.altitude);
            if (index === 0) context.moveTo(target[0], target[1]); else context.lineTo(target[0], target[1]);
        });
        if (!region.alwaysUp) {
            // Close the region along the horizon, continuing in the direction the sun moves.
            const quarter = Math.PI / 2;
            context.arc(center.x, center.y, radius,
                points[points.length - 1]!.azimuth - quarter, points[0]!.azimuth - quarter, turning < 0);
        }
        context.closePath();
    }

    private getLongestSegment(segments: readonly (readonly SkyPoint[])[]): readonly SkyPoint[] | null {
        let longest: readonly SkyPoint[] | null = null;
        for (const segment of segments) {
            if (segment.length >= 2 && (!longest || segment.length > longest.length)) longest = segment;
        }
        return longest;
    }

    private drawCircle(context: CanvasRenderingContext2D, center: L.Point, radius: number): void {
        context.save();
        context.setLineDash([6, 6]);
        context.strokeStyle = COLORS.crosshair;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(center.x - radius, center.y);
        context.lineTo(center.x + radius, center.y);
        context.moveTo(center.x, center.y - radius);
        context.lineTo(center.x, center.y + radius);
        context.stroke();
        context.restore();

        context.beginPath();
        context.arc(center.x, center.y, radius, 0, 2 * Math.PI);
        context.strokeStyle = COLORS.circle;
        context.lineWidth = 1.5;
        context.stroke();
    }

    /** Draws the lines from the centre to the azimuth of sunrise and sunset. */
    private drawHorizonLines(context: CanvasRenderingContext2D, center: L.Point, radius: number): void {
        const arc = this.#arc;
        if (!arc) return;

        const lines = [
            { azimuth: arc.sunriseAzimuth, color: COLORS.sunrise },
            { azimuth: arc.sunsetAzimuth, color: COLORS.sunset }
        ];
        context.lineWidth = 5;
        context.lineCap = 'round';
        for (const line of lines) {
            if (line.azimuth === null) continue;
            const end = this.getPoint(center, radius, line.azimuth, 0);
            context.beginPath();
            context.moveTo(center.x, center.y);
            context.lineTo(end[0], end[1]);
            context.strokeStyle = line.color;
            context.stroke();
        }
    }

    /** Draws the arc the sun follows on the selected day. */
    private drawDayArc(context: CanvasRenderingContext2D, center: L.Point, radius: number): void {
        if (!this.#arc) return;

        context.beginPath();
        for (const segment of this.#arc.segments) {
            segment.forEach((point, index) => {
                const target = this.getPoint(center, radius, point.azimuth, point.altitude);
                if (index === 0) context.moveTo(target[0], target[1]); else context.lineTo(target[0], target[1]);
            });
        }
        context.strokeStyle = COLORS.dayArc;
        context.lineWidth = 3;
        context.stroke();
    }

    /** Draws the direction of the sun and the sun symbol itself. */
    private drawSun(context: CanvasRenderingContext2D, center: L.Point, radius: number): void {
        const sun = this.#sun;
        if (!sun) return;

        const aboveHorizon = sun.altitude >= 0;
        const color = aboveHorizon ? COLORS.sun : COLORS.sunBelowHorizon;
        const position = this.getPoint(center, radius, sun.azimuth, sun.altitude);

        context.beginPath();
        context.moveTo(center.x, center.y);
        context.lineTo(position[0], position[1]);
        context.strokeStyle = aboveHorizon ? COLORS.sunRay : color;
        context.lineWidth = 6;
        context.lineCap = 'round';
        context.stroke();

        context.beginPath();
        context.arc(position[0], position[1], 11, 0, 2 * Math.PI);
        context.fillStyle = color;
        context.fill();
        context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        context.lineWidth = 1.5;
        context.stroke();
    }

    private drawLabels(context: CanvasRenderingContext2D, center: L.Point, radius: number): void {
        context.font = 'bold 14px "Arial Narrow", sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.lineWidth = 3;
        context.strokeStyle = 'white';
        context.fillStyle = COLORS.label;
        for (const label of DIRECTION_LABELS) {
            const x = center.x + Math.sin(label.azimuth) * (radius + 14);
            const y = center.y - Math.cos(label.azimuth) * (radius + 14);
            context.strokeText(label.text, x, y);
            context.fillText(label.text, x, y);
        }
    }
}
