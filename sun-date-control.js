/**
 * Menu block "Sonnenverlauf": calendar to pick the day of the calculation and a
 * refresh button that jumps back to the current date and time.
 */
function SunDateControl(containerId) {
    const control = this;
    control.container = document.getElementById(containerId);
    control.eventHandler = {};

    control.container.innerHTML = `
        <h4>Sonnenverlauf</h4>
        <div class="sun-date-row">
            <input type="date" id="sunDateInput">
            <button type="button" id="sunNowButton" title="Aktuelles Datum und aktuelle Uhrzeit übernehmen">⟳</button>
        </div>`;
    control.input = control.container.querySelector('#sunDateInput');

    control.input.addEventListener('change', () => {
        const parts = control.input.value.split('-');
        if (parts.length !== 3) return;
        const handler = control.eventHandler['datechanged'];
        if (handler) handler(new Date(+parts[0], +parts[1] - 1, +parts[2]));
    });

    control.container.querySelector('#sunNowButton').addEventListener('click', () => {
        const handler = control.eventHandler['nowselected'];
        if (handler) handler();
    });
}

SunDateControl.prototype.on = function (event, callback) {
    this.eventHandler[event] = callback;
}

/**
 * Shows the given day in the calendar input.
 * @param {Date} date Selected day in local time.
 */
SunDateControl.prototype.setDate = function (date) {
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    this.input.value = `${date.getFullYear()}-${month}-${day}`;
}
