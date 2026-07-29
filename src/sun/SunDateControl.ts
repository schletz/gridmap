import { TypedEventEmitter } from '../core/TypedEventEmitter';

interface SunDateControlEvents extends Record<string, unknown[]> {
    /** Another day was picked in the calendar. */
    datechanged: [date: Date];
    /** The user asked for the current date and time. */
    nowselected: [];
    /** The user pressed the live button; the caller decides the new state. */
    livetoggled: [];
}

/**
 * Menu block "Zeitpunkt": calendar to pick the day of the calculation, a refresh
 * button that jumps back to the current date and time and a live button that asks
 * for the system time to be followed continuously. The block is shared by every
 * time dependent feature, therefore its heading names no feature.
 *
 * The control is a pure view: it owns neither the selected moment nor the live
 * state, it only reports intentions and shows what it is told (setDate, setLive).
 */
export class SunDateControl extends TypedEventEmitter<SunDateControlEvents> {
    readonly #input: HTMLInputElement;
    readonly #liveButton: HTMLButtonElement;

    /**
     * @param container Element the control is rendered into.
     */
    constructor(container: HTMLElement) {
        super();
        container.innerHTML = `
            <h4>Zeitpunkt</h4>
            <div class="sun-date-row">
                <input type="date" id="sunDateInput">
                <button type="button" id="sunNowButton" title="Aktuelles Datum und aktuelle Uhrzeit übernehmen">⟳</button>
                <button type="button" id="sunLiveButton" class="live-button"></button>
            </div>`;
        this.#input = container.querySelector<HTMLInputElement>('#sunDateInput')!;
        this.#liveButton = container.querySelector<HTMLButtonElement>('#sunLiveButton')!;

        this.#input.addEventListener('change', () => {
            const parts = this.#input.value.split('-');
            if (parts.length !== 3) return;
            this.emit('datechanged', new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
        });

        container.querySelector('#sunNowButton')!
            .addEventListener('click', () => this.emit('nowselected'));
        this.#liveButton.addEventListener('click', () => this.emit('livetoggled'));
        this.setLive(false);
    }

    /**
     * Shows whether the system time is currently being followed.
     * @param live True while the live mode is running.
     */
    setLive(live: boolean): void {
        this.#liveButton.classList.toggle('active', live);
        this.#liveButton.title = live
            ? 'Live beenden, Zeitpunkt bleibt stehen'
            : 'Live: Systemzeit laufend übernehmen';
    }

    /**
     * Shows the given day in the calendar input.
     * @param date Selected day in local time.
     */
    setDate(date: Date): void {
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        this.#input.value = `${date.getFullYear()}-${month}-${day}`;
    }
}
