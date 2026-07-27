/**
 * Menu block "Solardaten": the event times of the selected day.
 * All times are printed in the local timezone of the user, independent of the
 * location the calculation is made for.
 */
function SunDataPanel(containerId) {
    this.container = document.getElementById(containerId);
    this.container.innerHTML = '<h4>Solardaten</h4><table class="sun-data-table"></table>';
    this.table = this.container.querySelector('table');
}

/**
 * Formats a moment in the local timezone of the user.
 * @param {Date} time Moment to format or null.
 * @returns {string} Time as hh:mm:ss in 24 hour notation or a dash.
 */
SunDataPanel.prototype.formatTime = function (time) {
    return time ? time.toLocaleTimeString([],
        { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '–';
}

/**
 * Formats a duration.
 * @param {number} durationMs Duration in milliseconds.
 * @returns {string} Duration as XhYmZs.
 */
SunDataPanel.prototype.formatDuration = function (durationMs) {
    const seconds = Math.round(durationMs / 1000);
    return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds / 60) % 60}m ${seconds % 60}s`;
}

/**
 * Shows the solar data of a day.
 * @param {object} day Day info as returned by SolarAstronomy.getDayInfo().
 */
SunDataPanel.prototype.setDay = function (day) {
    // At high latitudes the sun or the twilight may not cross the horizon at all.
    let note = '';
    if (day.sunAlwaysUp) note = 'Die Sonne geht an diesem Tag nicht unter.';
    else if (day.sunAlwaysDown) note = 'Die Sonne geht an diesem Tag nicht auf.';
    else if (day.twilightAllNight) note = 'Die Dämmerung endet in dieser Nacht nicht.';

    const rows = [
        ['Morgendämmerung', this.formatTime(day.dawn)],
        ['Sonnenaufgang', this.formatTime(day.sunrise)],
        ['Sonnenhöchststand', `${this.formatTime(day.solarNoon)} (${(day.maxAltitude * 180 / Math.PI).toFixed(1)}°)`],
        ['Sonnenuntergang', this.formatTime(day.sunset)],
        ['Abenddämmerung', this.formatTime(day.dusk)],
        ['Tageslänge', this.formatDuration(day.dayLengthMs)]
    ];

    this.table.innerHTML = rows
        .map(row => `<tr><td>${row[0]}:</td><td class="sun-data-value">${row[1]}</td></tr>`).join('')
        + (note ? `<tr><td colspan="2" class="sun-data-note">${note}</td></tr>` : '');
}
