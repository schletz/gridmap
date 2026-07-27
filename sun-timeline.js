/**
 * Timeline above the map. It paints night, twilight and daylight of the selected
 * day and carries a draggable knob that selects the moment of the calculation.
 *
 * The timeline always works in the local timezone of the user: it spans from
 * local midnight to the next local midnight, therefore days with a daylight
 * saving switch are mapped correctly onto the 0..1 range.
 */
function SunTimeline(containerId) {
    const timeline = this;
    timeline.container = document.getElementById(containerId);
    timeline.eventHandler = {};
    timeline.day = null;
    timeline.fraction = 0.5;

    timeline.container.classList.add('sun-timeline');
    timeline.container.innerHTML = `
        <div class="timeline-hours"></div>
        <div class="timeline-bar"><div class="timeline-knob"></div></div>`;
    timeline.hoursDiv = timeline.container.querySelector('.timeline-hours');
    timeline.barDiv = timeline.container.querySelector('.timeline-bar');
    timeline.knob = timeline.container.querySelector('.timeline-knob');

    const drag = (event) => {
        const bounds = timeline.barDiv.getBoundingClientRect();
        if (bounds.width === 0) return;
        const fraction = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
        timeline.setFraction(fraction);
        const handler = timeline.eventHandler['timechanged'];
        if (handler) handler(fraction);
    };

    timeline.barDiv.addEventListener('pointerdown', (event) => {
        timeline.barDiv.setPointerCapture(event.pointerId);
        drag(event);
    });
    timeline.barDiv.addEventListener('pointermove', (event) => {
        if (timeline.barDiv.hasPointerCapture(event.pointerId)) drag(event);
    });

    // The number of hour labels depends on the available width.
    new ResizeObserver(() => timeline.drawHours()).observe(timeline.container);
}

SunTimeline.prototype.on = function (event, callback) {
    this.eventHandler[event] = callback;
}

/**
 * Formats a moment as hh:mm in the local timezone of the user.
 * @param {Date} time Moment to format.
 * @returns {string} Time of day in 24 hour notation.
 */
SunTimeline.formatHour = function (time) {
    return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Converts a moment of the shown day into its position on the timeline.
 * @param {Date|number} time Moment within the shown day.
 * @returns {number} Position between 0 and 1.
 */
SunTimeline.prototype.getFractionOf = function (time) {
    const start = this.day.start.getTime();
    return (time.valueOf() - start) / (this.day.end.getTime() - start);
}

/**
 * Shows a new day.
 * @param {object} day Day info as returned by SolarAstronomy.getDayInfo().
 */
SunTimeline.prototype.setDay = function (day) {
    this.day = day;
    this.drawHours();
    this.drawBar();
}

/**
 * Moves the knob without firing an event.
 * @param {number} fraction Position between 0 and 1.
 */
SunTimeline.prototype.setFraction = function (fraction) {
    this.fraction = fraction;
    this.knob.style.left = `${(fraction * 100).toFixed(4)}%`;
    if (!this.day) return;
    const start = this.day.start.getTime();
    const time = new Date(start + fraction * (this.day.end.getTime() - start));
    this.knob.textContent = SunTimeline.formatHour(time);
}

/** Draws the hour scale, thinning the labels out on narrow screens. */
SunTimeline.prototype.drawHours = function () {
    if (!this.day) return;

    const width = this.container.clientWidth;
    const step = Math.max(1, Math.ceil(24 / Math.max(1, Math.floor(width / 55))));
    const date = this.day.start;
    let html = '';
    let previousFraction = -1;
    for (let hour = 0; hour < 24; hour += step) {
        const time = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour);
        const fraction = this.getFractionOf(time);
        // Die bei der Zeitumstellung übersprungene Stunde liefert dieselbe Position.
        if (fraction < 0 || fraction >= 1 || fraction === previousFraction) continue;
        previousFraction = fraction;
        const label = SunTimeline.formatHour(time);
        html += `<div class="timeline-hour" style="left:${(fraction * 100).toFixed(4)}%">${label}</div>`;
    }
    this.hoursDiv.innerHTML = html;
}

/**
 * Paints night, twilight and daylight as a gradient with hard colour stops.
 * The stops are taken from the sampled altitudes, so polar day, polar night and
 * twilight lasting the whole night are covered without special cases.
 */
SunTimeline.prototype.drawBar = function () {
    const twilightAltitude = SolarAstronomy.TWILIGHT_ALTITUDE * Math.PI / 180;
    const sunriseAltitude = SolarAstronomy.SUNRISE_ALTITUDE * Math.PI / 180;
    const colors = { night: '#2f4468', twilight: '#b9d9f0', day: '#ffe89e' };

    const classify = (altitude) => altitude >= sunriseAltitude
        ? 'day' : (altitude >= twilightAltitude ? 'twilight' : 'night');

    const samples = this.day.samples;
    const stops = [];
    let currentClass = null;
    for (const sample of samples) {
        const sampleClass = classify(sample.altitude);
        if (sampleClass === currentClass) continue;
        const position = (this.getFractionOf(sample.time) * 100).toFixed(3);
        if (currentClass !== null) stops.push(`${colors[currentClass]} ${position}%`);
        stops.push(`${colors[sampleClass]} ${position}%`);
        currentClass = sampleClass;
    }
    stops.push(`${colors[currentClass]} 100%`);

    this.barDiv.style.background = `linear-gradient(to right, ${stops.join(', ')})`;
}
