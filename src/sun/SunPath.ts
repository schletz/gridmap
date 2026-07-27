import type L from 'leaflet';
import type { LatLngTuple } from '../core/Geo';
import { TypedEventEmitter } from '../core/TypedEventEmitter';
import { EarthShadow } from './EarthShadow';
import { getDayArc, getDayBounds, getDayInfo, getSample, getSolsticeDates } from './SolarAstronomy';
import { SunCompass } from './SunCompass';
import { SunDataPanel } from './SunDataPanel';
import { SunDateControl } from './SunDateControl';
import { SunTimeline } from './SunTimeline';

/** Elements the feature renders into. */
export interface SunPathElements {
    readonly timeline: HTMLElement;
    readonly dateControl: HTMLElement;
    readonly dataPanel: HTMLElement;
    readonly toggleButton: HTMLButtonElement;
}

interface SunPathEvents extends Record<string, unknown[]> {
    /** The feature became visible or invisible. */
    activechanged: [active: boolean];
}

/** A home position that moved less than this is treated as unchanged. */
const HOME_TOLERANCE = 0.0005;

/**
 * Feature "Sonnenverlauf". It ties together the timeline above the map, the
 * bearing circle with the day arc, the earth shadow on the map, the calendar and
 * the solar data panel.
 *
 * The calculation is always made for the marker that is defined as home in the
 * marker list; without such a marker the feature stays disabled. The moment of
 * the calculation is the selected day combined with the position of the knob on
 * the timeline.
 */
export class SunPath extends TypedEventEmitter<SunPathEvents> {
    readonly #timeline: SunTimeline;
    readonly #dateControl: SunDateControl;
    readonly #dataPanel: SunDataPanel;
    readonly #compass: SunCompass;
    readonly #shadow: EarthShadow;

    #home: LatLngTuple | null = null;
    #requested = false;
    #date = new Date();
    #fraction = 0;

    /**
     * @param map Map the overlays are drawn on.
     * @param elements Elements of the feature.
     */
    constructor(private readonly map: L.Map, private readonly elements: SunPathElements) {
        super();
        this.#timeline = new SunTimeline(elements.timeline);
        this.#dateControl = new SunDateControl(elements.dateControl);
        this.#dataPanel = new SunDataPanel(elements.dataPanel);
        this.#compass = new SunCompass(map);
        this.#shadow = new EarthShadow(map);

        this.#timeline.on('timechanged', (fraction) => {
            this.#fraction = fraction;
            this.updateMoment();
        });
        this.#dateControl.on('datechanged', (date) => this.setDate(date));
        this.#dateControl.on('nowselected', () => this.setToNow());
        elements.toggleButton.addEventListener('click', () => this.setRequested(!this.#requested));

        this.setToNow();
        this.updateVisibility();
    }

    /** True when a home marker exists and the user has switched the feature on. */
    isActive(): boolean {
        return this.#requested && this.#home !== null;
    }

    /**
     * Sets the location the sun path is calculated for.
     * @param latlng Home position or null if no home marker exists.
     */
    setHome(latlng: LatLngTuple | null): void {
        // A moving gps position must not trigger a full recalculation for every metre.
        const unchanged = latlng !== null && this.#home !== null
            && Math.abs(latlng[0] - this.#home[0]) < HOME_TOLERANCE
            && Math.abs(latlng[1] - this.#home[1]) < HOME_TOLERANCE;
        this.#home = latlng;
        if (unchanged) {
            this.#compass.setCenter(latlng);
            return;
        }
        this.updateVisibility();
        this.updateDay();
    }

    /**
     * Switches the feature on or off. It only becomes visible if a home marker exists.
     * @param requested True if the user wants to see the sun path.
     */
    setRequested(requested: boolean): void {
        this.#requested = requested;
        this.updateVisibility();
        this.updateDay();
    }

    /**
     * Selects the day of the calculation and keeps the time of day.
     * @param date Day in local time.
     */
    setDate(date: Date): void {
        this.#date = date;
        this.updateDay();
    }

    /** Takes over the current date and the current time. */
    setToNow(): void {
        const now = new Date();
        const bounds = getDayBounds(now);
        this.#date = now;
        this.#fraction = (now.getTime() - bounds.start.getTime())
            / (bounds.end.getTime() - bounds.start.getTime());
        this.#dateControl.setDate(now);
        this.updateDay();
    }

    /** The moment the calculation is made for. */
    getTime(): Date {
        const bounds = getDayBounds(this.#date);
        const start = bounds.start.getTime();
        return new Date(start + this.#fraction * (bounds.end.getTime() - start));
    }

    /** Shows or hides all parts of the feature and updates the toggle button. */
    private updateVisibility(): void {
        const active = this.isActive();
        const hadTimeline = !this.elements.timeline.hidden;
        const button = this.elements.toggleButton;

        button.classList.toggle('active', active);
        button.disabled = this.#home === null;
        button.title = this.#home === null
            ? 'Kein Marker als Home definiert'
            : (active ? 'Sonnenverlauf ausblenden' : 'Sonnenverlauf anzeigen');

        this.elements.timeline.hidden = !active;
        this.elements.dateControl.hidden = !active;
        this.elements.dataPanel.hidden = !active;
        this.#compass.setVisible(active);
        this.#shadow.setVisible(active);
        this.emit('activechanged', active);

        // The timeline takes space away from the map.
        if (hadTimeline !== active) this.map.invalidateSize();
    }

    /** Recalculates everything that only depends on the day and the location. */
    private updateDay(): void {
        const home = this.#home;
        if (!home || !this.isActive()) return;

        const [lat, lng] = home;
        this.#dateControl.setDate(this.#date);
        const day = getDayInfo(this.#date, lat, lng);

        this.#timeline.setDay(day);
        this.#dataPanel.setDay(day);
        this.#compass.setCenter(home);
        this.#compass.setDayArc(getDayArc(this.#date, lat, lng, 1));
        this.#compass.setYearRegions(getSolsticeDates(this.#date.getFullYear())
            .map(solstice => getDayArc(solstice, lat, lng, 2)));
        this.updateMoment();
    }

    /** Recalculates everything that depends on the selected moment. */
    private updateMoment(): void {
        const home = this.#home;
        if (!home || !this.isActive()) return;

        const time = this.getTime();
        this.#timeline.setFraction(this.#fraction);
        this.#compass.setSun(getSample(time.getTime(), home[0], home[1]));
        this.#shadow.setTime(time);
    }
}
