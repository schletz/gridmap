import { TypedEventEmitter } from '../core/TypedEventEmitter';
import { getDayBounds, type SolarDayInfo } from './SolarAstronomy';
import { SunDateControl } from './SunDateControl';
import { SunTimeline } from './SunTimeline';

/** Elements the selection renders into. */
export interface TimeSelectionElements {
    /** Timeline above the map. */
    readonly timeline: HTMLElement;
    /** Menu block with the calendar. */
    readonly dateControl: HTMLElement;
}

/** Distance between two updates of the live mode in milliseconds. */
const LIVE_INTERVAL = 1000;

interface TimeSelectionEvents extends Record<string, unknown[]> {
    /** Another day was selected; always followed by momentchanged. */
    daychanged: [date: Date];
    /** The selected moment changed, either by a new day or by the knob. */
    momentchanged: [time: Date];
    /** The controls were shown or hidden, which changes the size of the map. */
    visibilitychanged: [visible: boolean];
}

/**
 * The moment every time dependent feature is calculated for: the calendar in the
 * menu picks the day, the knob of the timeline above the map picks the time of
 * day.
 *
 * The controls belong to no single feature. SunPath and WorldTime share them, so
 * the owner decides when they are visible and which brightness the timeline
 * paints (setDay); on its own the selection knows nothing about a location.
 */
export class TimeSelection extends TypedEventEmitter<TimeSelectionEvents> {
    readonly #timeline: SunTimeline;
    readonly #dateControl: SunDateControl;

    #date = new Date();
    #fraction = 0;
    #visible = false;
    #live = false;
    /** Handle of the live timer, undefined while the live mode is off. */
    #liveTimer: ReturnType<typeof setInterval> | undefined;

    /**
     * @param elements Elements of the two controls.
     */
    constructor(private readonly elements: TimeSelectionElements) {
        super();
        this.#timeline = new SunTimeline(elements.timeline);
        this.#dateControl = new SunDateControl(elements.dateControl);

        // Every manual selection ends the live mode, otherwise the next tick would
        // immediately overwrite what the user just picked.
        this.#timeline.on('timechanged', (fraction) => {
            this.setLive(false);
            this.#fraction = fraction;
            this.update(false);
        });
        this.#dateControl.on('datechanged', (date) => {
            this.setLive(false);
            this.setDate(date);
        });
        this.#dateControl.on('nowselected', () => {
            this.setLive(false);
            this.setToNow();
        });
        this.#dateControl.on('livetoggled', () => this.setLive(!this.#live));

        elements.timeline.hidden = true;
        elements.dateControl.hidden = true;
        this.setToNow();
    }

    /** The moment the calculation is made for. */
    getTime(): Date {
        const bounds = getDayBounds(this.#date);
        const start = bounds.start.getTime();
        return new Date(start + this.#fraction * (bounds.end.getTime() - start));
    }

    /**
     * Shows or hides both controls.
     * @param visible True if at least one feature needs the selection.
     */
    setVisible(visible: boolean): void {
        if (visible === this.#visible) return;
        this.#visible = visible;
        this.elements.timeline.hidden = !visible;
        this.elements.dateControl.hidden = !visible;
        // Nobody listens while every feature is off, so the timer would only burn
        // cycles - and the hidden live button could not be switched off any more.
        if (!visible) this.setLive(false);
        this.emit('visibilitychanged', visible);
    }

    /** True while the selection follows the system time. */
    isLive(): boolean {
        return this.#live;
    }

    /**
     * Starts or stops following the system time. While it runs, the selection is
     * set to the current moment once per second.
     * @param live True to follow the system time.
     */
    setLive(live: boolean): void {
        if (live === this.#live) return;
        this.#live = live;
        this.#dateControl.setLive(live);

        if (this.#liveTimer !== undefined) {
            clearInterval(this.#liveTimer);
            this.#liveTimer = undefined;
        }
        if (!live) return;

        this.#liveTimer = setInterval(() => this.applyNow(false), LIVE_INTERVAL);
        this.applyNow(false);
    }

    /**
     * Selects the day of the calculation and keeps the time of day.
     * @param date Day in local time.
     */
    setDate(date: Date): void {
        this.#date = date;
        this.update(true);
    }

    /** Takes over the current date and the current time. */
    setToNow(): void {
        this.applyNow(true);
    }

    /**
     * Takes over the current moment.
     * @param forceDay True to announce a new day even if it is the same one. Every
     * day change costs the listeners a full day calculation, therefore the live
     * mode passes false and only pays it at midnight.
     */
    private applyNow(forceDay: boolean): void {
        const now = new Date();
        const bounds = getDayBounds(now);
        const dayChanged = forceDay || bounds.start.getTime() !== getDayBounds(this.#date).start.getTime();
        this.#date = now;
        this.#fraction = (now.getTime() - bounds.start.getTime())
            / (bounds.end.getTime() - bounds.start.getTime());
        this.update(dayChanged);
    }

    /**
     * Colours the timeline. Only a feature that knows a location can supply this,
     * the selection itself never calculates it.
     * @param day Day info as returned by getDayInfo() or null for a neutral bar.
     */
    setDay(day: SolarDayInfo | null): void {
        this.#timeline.setDay(day);
    }

    /** Re-emits the current selection so freshly connected listeners catch up. */
    refresh(): void {
        this.update(true);
    }

    /**
     * Updates both controls and announces the new selection.
     * @param dayChanged True if not only the time of day changed. Redrawing the
     * hour scale is only needed then, dragging the knob must not rebuild it.
     */
    private update(dayChanged: boolean): void {
        if (dayChanged) {
            this.#dateControl.setDate(this.#date);
            this.#timeline.setBounds(getDayBounds(this.#date));
        }
        this.#timeline.setFraction(this.#fraction);
        if (dayChanged) this.emit('daychanged', this.#date);
        this.emit('momentchanged', this.getTime());
    }
}
