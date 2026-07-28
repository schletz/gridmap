import type L from 'leaflet';
import type { LatLngTuple } from '../core/Geo';
import { TypedEventEmitter } from '../core/TypedEventEmitter';
import {
    getDayArc, getDayInfo, getSample, getSolsticeDates, type SolarDayInfo
} from './SolarAstronomy';
import { SunCompass } from './SunCompass';
import { SunDataPanel } from './SunDataPanel';

/** Elements the feature renders into. */
export interface SunPathElements {
    readonly dataPanel: HTMLElement;
    readonly toggleButton: HTMLButtonElement;
}

interface SunPathEvents extends Record<string, unknown[]> {
    /** The feature became visible or invisible. */
    activechanged: [active: boolean];
    /** Solar data of the selected day; null while the feature is switched off. */
    daychanged: [day: SolarDayInfo | null];
}

/** A home position that moved less than this is treated as unchanged. */
const HOME_TOLERANCE = 0.0005;

/**
 * Feature "Sonnenverlauf". It ties together the bearing circle with the day arc
 * and the solar data panel.
 *
 * The calculation is always made for the marker that is defined as home in the
 * marker list; without such a marker the feature stays disabled. The day and the
 * time of day are not chosen here but come from the shared TimeSelection, which
 * in turn gets the calculated day back to colour its timeline.
 */
export class SunPath extends TypedEventEmitter<SunPathEvents> {
    readonly #dataPanel: SunDataPanel;
    readonly #compass: SunCompass;

    #home: LatLngTuple | null = null;
    #requested = false;
    #date = new Date();
    #time = new Date();

    /**
     * @param map Map the bearing circle is drawn on.
     * @param elements Elements of the feature.
     */
    constructor(map: L.Map, private readonly elements: SunPathElements) {
        super();
        this.#dataPanel = new SunDataPanel(elements.dataPanel);
        this.#compass = new SunCompass(map);

        elements.toggleButton.addEventListener('click', () => this.setRequested(!this.#requested));
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
     * Selects the day of the calculation.
     * @param date Day in local time.
     */
    setDate(date: Date): void {
        this.#date = date;
        this.updateDay();
    }

    /**
     * Selects the moment within the day.
     * @param time Moment of the calculation.
     */
    setMoment(time: Date): void {
        this.#time = time;
        this.updateMoment();
    }

    /** Shows or hides all parts of the feature and updates the toggle button. */
    private updateVisibility(): void {
        const active = this.isActive();
        const button = this.elements.toggleButton;

        button.classList.toggle('active', active);
        button.disabled = this.#home === null;
        button.title = this.#home === null
            ? 'Kein Marker als Home definiert'
            : (active ? 'Sonnenverlauf ausblenden' : 'Sonnenverlauf anzeigen');

        this.elements.dataPanel.hidden = !active;
        this.#compass.setVisible(active);
        this.emit('activechanged', active);
    }

    /**
     * Recalculates everything that only depends on the day and the location.
     *
     * The solar data of the day is published as soon as a home marker exists, even
     * while the feature itself is switched off: the timeline is shared with
     * WorldTime and colours its bar from it. Without a home marker no brightness
     * can be calculated at all, then the event carries null.
     */
    private updateDay(): void {
        const home = this.#home;
        if (!home) {
            this.emit('daychanged', null);
            return;
        }

        const [lat, lng] = home;
        const day = getDayInfo(this.#date, lat, lng);
        this.emit('daychanged', day);
        if (!this.isActive()) return;

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

        this.#compass.setSun(getSample(this.#time.getTime(), home[0], home[1]));
    }
}
