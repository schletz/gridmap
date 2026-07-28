import type L from 'leaflet';
import { MapCanvasOverlay } from '../map/MapCanvasOverlay';
import { getSubsolarLongitude } from './SolarAstronomy';

/** Spacing of the grid in degrees; the earth turns 15° per hour. */
const HOUR_SPACING = 15;

/** Upper bound of drawn meridians, a guard for views showing many world copies. */
const MAX_LINES = 100;

/** Colour of the meridians and of their labels. */
const LINE_COLOR = '#d40000';
/** Width of the meridian the sun stands in. */
const NOON_WIDTH = 3;
/** Width of the other hour meridians. */
const HOUR_WIDTH = 1;

const LABEL_FONT = 'bold 15px "Arial Narrow", Arial, sans-serif';
/** Distance of the labels from the upper border of the map in pixels. */
const LABEL_TOP = 6;

/**
 * Grid of the true local time (wahre Ortszeit).
 *
 * Technically a longitude grid with a spacing of 15°, anchored at the meridian
 * the sun currently stands in. That meridian carries the true local time 12:00
 * and is drawn thicker; every further meridian to the east is one hour later.
 *
 * Unlike the coordinate grids the lines are painted on a canvas in container
 * coordinates instead of being leaflet layers. Leaflet clamps every latitude to
 * the mercator limit of 85.05°, so labels anchored to a position would stick to
 * the upper border of the world map as soon as the user pans past it. In
 * container coordinates they stay at the upper border of the view instead.
 */
export class SolarTimeGrid extends MapCanvasOverlay {
    #time: Date | null = null;

    constructor(map: L.Map) {
        super(map, 'solar-time-grid', 402);
    }

    /**
     * Sets the moment the grid is drawn for.
     * @param time Moment of the calculation.
     */
    setTime(time: Date): void {
        this.#time = time;
        this.redraw();
    }

    protected override draw(context: CanvasRenderingContext2D, size: L.Point): void {
        if (!this.#time) return;

        // In the web mercator projection the longitude is linear in x, so the two
        // borders of the view are enough to place every meridian.
        const west = this.map.containerPointToLatLng([0, 0]).lng;
        const east = this.map.containerPointToLatLng([size.x, 0]).lng;
        if (east <= west) return;

        const noonLongitude = getSubsolarLongitude(this.#time);
        // Hour offsets counted from the noon meridian; a world copy adds a multiple of 24.
        const first = Math.ceil((west - noonLongitude) / HOUR_SPACING);
        const last = Math.min(first + MAX_LINES - 1, Math.floor((east - noonLongitude) / HOUR_SPACING));

        const labels: { x: number; text: string }[] = [];
        context.strokeStyle = LINE_COLOR;
        for (const width of [HOUR_WIDTH, NOON_WIDTH]) {
            context.lineWidth = width;
            context.beginPath();
            for (let hour = first; hour <= last; hour++) {
                const clock = ((12 + hour) % 24 + 24) % 24;
                if ((clock === 12 ? NOON_WIDTH : HOUR_WIDTH) !== width) continue;

                // Half a pixel offset keeps a line of odd width on the pixel grid.
                const x = Math.round((noonLongitude + hour * HOUR_SPACING - west)
                    * size.x / (east - west)) + 0.5;
                context.moveTo(x, 0);
                context.lineTo(x, size.y);
                labels.push({ x, text: `${clock}h` });
            }
            context.stroke();
        }

        this.drawLabels(context, labels);
    }

    /**
     * Draws the hour labels at the upper border of the view.
     * @param context Canvas context.
     * @param labels Label texts and their x positions.
     */
    private drawLabels(context: CanvasRenderingContext2D, labels: readonly { x: number; text: string }[]): void {
        context.font = LABEL_FONT;
        context.textAlign = 'center';
        context.textBaseline = 'top';
        // White outline below the text, like the text-shadow of the other grid labels.
        context.strokeStyle = '#fff';
        context.lineWidth = 3;
        context.lineJoin = 'round';
        context.fillStyle = LINE_COLOR;
        for (const label of labels) context.strokeText(label.text, label.x, LABEL_TOP);
        for (const label of labels) context.fillText(label.text, label.x, LABEL_TOP);
    }
}
