import { toDegrees } from '../core/Geo';
import type { SolarDayInfo } from './SolarAstronomy';

/**
 * Menu block "Solardaten": the event times of the selected day.
 * All times are printed in the local timezone of the user, independent of the
 * location the calculation is made for.
 */
export class SunDataPanel {
    readonly #table: HTMLTableElement;

    /**
     * @param container Element the panel is rendered into.
     */
    constructor(container: HTMLElement) {
        container.innerHTML = '<h4>Solardaten</h4><table class="sun-data-table"></table>';
        this.#table = container.querySelector('table')!;
    }

    /**
     * Formats a moment in the local timezone of the user.
     * @param time Moment to format or null.
     * @returns Time as hh:mm:ss in 24 hour notation or a dash.
     */
    static formatTime(time: Date | null): string {
        return time ? time.toLocaleTimeString([],
            { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '–';
    }

    /**
     * Formats a duration.
     * @param durationMs Duration in milliseconds.
     * @returns Duration as XhYmZs.
     */
    static formatDuration(durationMs: number): string {
        const seconds = Math.round(durationMs / 1000);
        return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds / 60) % 60}m ${seconds % 60}s`;
    }

    /**
     * Shows the solar data of a day.
     * @param day Day info as returned by getDayInfo().
     */
    setDay(day: SolarDayInfo): void {
        const rows: readonly (readonly [string, string])[] = [
            ['Morgendämmerung', SunDataPanel.formatTime(day.dawn)],
            ['Sonnenaufgang', SunDataPanel.formatTime(day.sunrise)],
            ['Sonnenhöchststand',
                `${SunDataPanel.formatTime(day.solarNoon)} (${toDegrees(day.maxAltitude).toFixed(1)}°)`],
            ['Sonnenuntergang', SunDataPanel.formatTime(day.sunset)],
            ['Abenddämmerung', SunDataPanel.formatTime(day.dusk)],
            ['Tageslänge', SunDataPanel.formatDuration(day.dayLengthMs)]
        ];

        const note = this.getNote(day);
        this.#table.innerHTML = rows
            .map(row => `<tr><td>${row[0]}:</td><td class="sun-data-value">${row[1]}</td></tr>`).join('')
            + (note ? `<tr><td colspan="2" class="sun-data-note">${note}</td></tr>` : '');
    }

    /** At high latitudes the sun or the twilight may not cross the horizon at all. */
    private getNote(day: SolarDayInfo): string {
        if (day.sunAlwaysUp) return 'Die Sonne geht an diesem Tag nicht unter.';
        if (day.sunAlwaysDown) return 'Die Sonne geht an diesem Tag nicht auf.';
        if (day.twilightAllNight) return 'Die Dämmerung endet in dieser Nacht nicht.';
        return '';
    }
}
