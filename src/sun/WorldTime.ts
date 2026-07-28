import type L from 'leaflet';
import { TypedEventEmitter } from '../core/TypedEventEmitter';
import { EarthShadow } from './EarthShadow';
import { SolarTimeGrid } from './SolarTimeGrid';

interface WorldTimeEvents extends Record<string, unknown[]> {
    /** The feature became visible or invisible. */
    activechanged: [active: boolean];
}

/**
 * Feature "Weltzeit": the earth shadow and the grid of the true local time.
 *
 * Both overlays are derived from the position of the sun over the whole globe and
 * therefore need no reference location. Unlike the sun path the feature can be
 * switched on at any time, with or without a home marker. The moment it is drawn
 * for comes from the shared TimeSelection.
 */
export class WorldTime extends TypedEventEmitter<WorldTimeEvents> {
    readonly #shadow: EarthShadow;
    readonly #timeGrid: SolarTimeGrid;

    #active = false;
    #time = new Date();

    /**
     * @param map Map the overlays are drawn on.
     * @param toggleButton Button that switches the feature on and off.
     */
    constructor(map: L.Map, private readonly toggleButton: HTMLButtonElement) {
        super();
        this.#shadow = new EarthShadow(map);
        this.#timeGrid = new SolarTimeGrid(map);

        toggleButton.addEventListener('click', () => this.setActive(!this.#active));
        this.updateVisibility();
    }

    /** True when the user has switched the feature on. */
    isActive(): boolean {
        return this.#active;
    }

    /**
     * Switches the feature on or off.
     * @param active True if the user wants to see the shadow and the time grid.
     */
    setActive(active: boolean): void {
        if (active === this.#active) return;
        this.#active = active;
        this.updateVisibility();
    }

    /**
     * Sets the moment both overlays are drawn for. The moment is remembered while
     * the feature is off, so switching it on shows the current selection at once.
     * @param time Moment of the calculation.
     */
    setTime(time: Date): void {
        this.#time = time;
        if (!this.#active) return;
        this.#shadow.setTime(time);
        this.#timeGrid.setTime(time);
    }

    /** Shows or hides both overlays and updates the toggle button. */
    private updateVisibility(): void {
        this.toggleButton.classList.toggle('active', this.#active);
        this.toggleButton.title = this.#active
            ? 'Erdschatten und Ortszeit ausblenden'
            : 'Erdschatten und Ortszeit anzeigen';

        this.#shadow.setVisible(this.#active);
        this.#timeGrid.setVisible(this.#active);
        this.setTime(this.#time);
        this.emit('activechanged', this.#active);
    }
}
