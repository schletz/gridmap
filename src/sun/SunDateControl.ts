import { TypedEventEmitter } from '../core/TypedEventEmitter';

interface SunDateControlEvents extends Record<string, unknown[]> {
    /** Another day was picked in the calendar. */
    datechanged: [date: Date];
    /** The user asked for the current date and time. */
    nowselected: [];
}

/**
 * Menu block "Sonnenverlauf": calendar to pick the day of the calculation and a
 * refresh button that jumps back to the current date and time.
 */
export class SunDateControl extends TypedEventEmitter<SunDateControlEvents> {
    readonly #input: HTMLInputElement;

    /**
     * @param container Element the control is rendered into.
     */
    constructor(container: HTMLElement) {
        super();
        container.innerHTML = `
            <h4>Sonnenverlauf</h4>
            <div class="sun-date-row">
                <input type="date" id="sunDateInput">
                <button type="button" id="sunNowButton" title="Aktuelles Datum und aktuelle Uhrzeit übernehmen">⟳</button>
            </div>`;
        this.#input = container.querySelector<HTMLInputElement>('#sunDateInput')!;

        this.#input.addEventListener('change', () => {
            const parts = this.#input.value.split('-');
            if (parts.length !== 3) return;
            this.emit('datechanged', new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
        });

        container.querySelector('#sunNowButton')!
            .addEventListener('click', () => this.emit('nowselected'));
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
