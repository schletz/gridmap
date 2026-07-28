import { toRadians } from '../core/Geo';
import { TypedEventEmitter } from '../core/TypedEventEmitter';
import {
    getDayBounds, SUNRISE_ALTITUDE, TWILIGHT_ALTITUDE,
    type DayBounds, type SolarDayInfo
} from './SolarAstronomy';

interface SunTimelineEvents extends Record<string, unknown[]> {
    /** The user moved the knob; the argument is the position between 0 and 1. */
    timechanged: [fraction: number];
}

/** Colours of the three brightness classes of the bar. */
const CLASS_COLORS = { night: '#2f4468', twilight: '#b9d9f0', day: '#ffe89e' } as const;

type BrightnessClass = keyof typeof CLASS_COLORS;

/** Colour of the bar while no solar data is available, i.e. without a home marker. */
const NO_DATA_COLOR = '#7d8794';

/** Approximate width in pixels one hour label needs. */
const HOUR_LABEL_WIDTH = 55;

/**
 * Timeline above the map. It paints night, twilight and daylight of the selected
 * day and carries a draggable knob that selects the moment of the calculation.
 *
 * The day itself (setBounds) and its brightness (setDay) are set separately: the
 * timeline also serves features that work without a location, and those leave the
 * bar in a neutral colour.
 *
 * The timeline always works in the local timezone of the user: it spans from
 * local midnight to the next local midnight, therefore days with a daylight
 * saving switch are mapped correctly onto the 0..1 range.
 */
export class SunTimeline extends TypedEventEmitter<SunTimelineEvents> {
    readonly #hoursDiv: HTMLElement;
    readonly #barDiv: HTMLElement;
    readonly #knob: HTMLElement;
    #bounds: DayBounds = getDayBounds(new Date());
    #day: SolarDayInfo | null = null;

    /**
     * @param container Element the timeline is rendered into.
     */
    constructor(private readonly container: HTMLElement) {
        super();
        container.classList.add('sun-timeline');
        container.innerHTML = `
            <div class="timeline-hours"></div>
            <div class="timeline-bar"><div class="timeline-knob"></div></div>`;
        this.#hoursDiv = container.querySelector('.timeline-hours')!;
        this.#barDiv = container.querySelector('.timeline-bar')!;
        this.#knob = container.querySelector('.timeline-knob')!;

        this.#barDiv.addEventListener('pointerdown', (event) => {
            this.#barDiv.setPointerCapture(event.pointerId);
            this.drag(event);
        });
        this.#barDiv.addEventListener('pointermove', (event) => {
            if (this.#barDiv.hasPointerCapture(event.pointerId)) this.drag(event);
        });

        // The number of hour labels depends on the available width.
        new ResizeObserver(() => this.drawHours()).observe(container);
    }

    /**
     * Formats a moment as hh:mm in the local timezone of the user.
     * @param time Moment to format.
     */
    static formatHour(time: Date): string {
        return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    /**
     * Shows the hour scale of another day.
     * @param bounds Local midnight to local midnight of the selected day.
     */
    setBounds(bounds: DayBounds): void {
        this.#bounds = bounds;
        this.drawHours();
    }

    /**
     * Shows the brightness of the selected day.
     * @param day Day info as returned by getDayInfo() or null if no location is known.
     */
    setDay(day: SolarDayInfo | null): void {
        this.#day = day;
        this.drawBar();
    }

    /**
     * Moves the knob without firing an event.
     * @param fraction Position between 0 and 1.
     */
    setFraction(fraction: number): void {
        this.#knob.style.left = `${(fraction * 100).toFixed(4)}%`;
        const start = this.#bounds.start.getTime();
        this.#knob.textContent = SunTimeline.formatHour(
            new Date(start + fraction * (this.#bounds.end.getTime() - start)));
    }

    /** Translates a pointer position into a knob position. */
    private drag(event: PointerEvent): void {
        const bounds = this.#barDiv.getBoundingClientRect();
        if (bounds.width === 0) return;
        const fraction = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
        this.setFraction(fraction);
        this.emit('timechanged', fraction);
    }

    /**
     * Converts a moment of the shown day into its position on the timeline.
     * @param bounds Bounds of the currently shown day.
     * @param time Moment within that day.
     * @returns Position between 0 and 1.
     */
    private getFractionOf(bounds: DayBounds, time: Date | number): number {
        const start = bounds.start.getTime();
        return (time.valueOf() - start) / (bounds.end.getTime() - start);
    }

    /** Draws the hour scale, thinning the labels out on narrow screens. */
    private drawHours(): void {
        const width = this.container.clientWidth;
        const step = Math.max(1, Math.ceil(24 / Math.max(1, Math.floor(width / HOUR_LABEL_WIDTH))));
        const date = this.#bounds.start;
        let html = '';
        let previousFraction = -1;
        for (let hour = 0; hour < 24; hour += step) {
            const time = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour);
            const fraction = this.getFractionOf(this.#bounds, time);
            // Die bei der Zeitumstellung übersprungene Stunde liefert dieselbe Position.
            if (fraction < 0 || fraction >= 1 || fraction === previousFraction) continue;
            previousFraction = fraction;
            const label = SunTimeline.formatHour(time);
            html += `<div class="timeline-hour" style="left:${(fraction * 100).toFixed(4)}%">${label}</div>`;
        }
        this.#hoursDiv.innerHTML = html;
    }

    /**
     * Paints night, twilight and daylight as a gradient with hard colour stops.
     * The stops are taken from the sampled altitudes, so polar day, polar night and
     * twilight lasting the whole night are covered without special cases.
     * Without solar data the bar stays neutral.
     */
    private drawBar(): void {
        const day = this.#day;
        if (!day) {
            this.#barDiv.style.background = NO_DATA_COLOR;
            return;
        }

        const twilightAltitude = toRadians(TWILIGHT_ALTITUDE);
        const sunriseAltitude = toRadians(SUNRISE_ALTITUDE);
        const classify = (altitude: number): BrightnessClass => altitude >= sunriseAltitude
            ? 'day' : (altitude >= twilightAltitude ? 'twilight' : 'night');

        const stops: string[] = [];
        let currentClass: BrightnessClass | null = null;
        for (const sample of day.samples) {
            const sampleClass = classify(sample.altitude);
            if (sampleClass === currentClass) continue;
            const position = (this.getFractionOf(day, sample.time) * 100).toFixed(3);
            if (currentClass !== null) stops.push(`${CLASS_COLORS[currentClass]} ${position}%`);
            stops.push(`${CLASS_COLORS[sampleClass]} ${position}%`);
            currentClass = sampleClass;
        }
        if (currentClass !== null) stops.push(`${CLASS_COLORS[currentClass]} 100%`);

        this.#barDiv.style.background = `linear-gradient(to right, ${stops.join(', ')})`;
    }
}
