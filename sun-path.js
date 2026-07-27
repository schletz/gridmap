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
function SunPath(map, options) {
    const sunPath = this;
    sunPath.map = map;
    sunPath.home = null;
    sunPath.requested = false;
    sunPath.day = null;
    sunPath.fraction = 0;
    sunPath.date = new Date();

    sunPath.timelineDiv = document.getElementById(options.timelineId);
    sunPath.dateDiv = document.getElementById(options.dateControlId);
    sunPath.dataDiv = document.getElementById(options.dataPanelId);
    sunPath.toggleButton = document.getElementById(options.toggleButtonId);

    sunPath.timeline = new SunTimeline(options.timelineId);
    sunPath.dateControl = new SunDateControl(options.dateControlId);
    sunPath.dataPanel = new SunDataPanel(options.dataPanelId);
    sunPath.compass = new SunCompass(map);
    sunPath.shadow = new EarthShadow(map);

    sunPath.timeline.on('timechanged', (fraction) => {
        sunPath.fraction = fraction;
        sunPath.updateMoment();
    });
    sunPath.dateControl.on('datechanged', (date) => sunPath.setDate(date));
    sunPath.dateControl.on('nowselected', () => sunPath.setToNow());
    sunPath.toggleButton.addEventListener('click', () => sunPath.setRequested(!sunPath.requested));

    sunPath.setToNow();
    sunPath.updateVisibility();
}

/** True when a home marker exists and the user has switched the feature on. */
SunPath.prototype.isActive = function () {
    return this.requested && this.home !== null;
}

/**
 * Sets the location the sun path is calculated for.
 * @param {number[]} latlng Home position as [lat, lng] or null if no home marker exists.
 */
SunPath.prototype.setHome = function (latlng) {
    // A moving gps position must not trigger a full recalculation for every metre.
    const unchanged = latlng !== null && this.home !== null
        && Math.abs(latlng[0] - this.home[0]) < 0.0005 && Math.abs(latlng[1] - this.home[1]) < 0.0005;
    this.home = latlng;
    if (unchanged) {
        this.compass.setCenter(latlng);
        return;
    }
    this.updateVisibility();
    this.updateDay();
}

/**
 * Switches the feature on or off. It only becomes visible if a home marker exists.
 * @param {boolean} requested True if the user wants to see the sun path.
 */
SunPath.prototype.setRequested = function (requested) {
    this.requested = requested;
    this.updateVisibility();
    this.updateDay();
}

/**
 * Selects the day of the calculation and keeps the time of day.
 * @param {Date} date Day in local time.
 */
SunPath.prototype.setDate = function (date) {
    this.date = date;
    this.updateDay();
}

/** Takes over the current date and the current time. */
SunPath.prototype.setToNow = function () {
    const now = new Date();
    const bounds = SolarAstronomy.getDayBounds(now);
    this.date = now;
    this.fraction = (now.getTime() - bounds.start.getTime()) / (bounds.end.getTime() - bounds.start.getTime());
    this.dateControl.setDate(now);
    this.updateDay();
}

/** The moment the calculation is made for. */
SunPath.prototype.getTime = function () {
    const bounds = SolarAstronomy.getDayBounds(this.date);
    const start = bounds.start.getTime();
    return new Date(start + this.fraction * (bounds.end.getTime() - start));
}

/** Shows or hides all parts of the feature and updates the toggle button. */
SunPath.prototype.updateVisibility = function () {
    const active = this.isActive();
    const hadTimeline = !this.timelineDiv.hidden;

    this.toggleButton.classList.toggle('active', active);
    this.toggleButton.disabled = this.home === null;
    this.toggleButton.title = this.home === null
        ? 'Kein Marker als Home definiert'
        : (active ? 'Sonnenverlauf ausblenden' : 'Sonnenverlauf anzeigen');

    this.timelineDiv.hidden = !active;
    this.dateDiv.hidden = !active;
    this.dataDiv.hidden = !active;
    this.compass.setVisible(active);
    this.shadow.setVisible(active);
    // Die Entfernungskreise um den Home Marker würden den Peilkreis überlagern.
    this.map.setDistanceCirclesEnabled(!active);

    // The timeline takes space away from the map.
    if (hadTimeline !== active) this.map.invalidateSize();
}

/** Recalculates everything that only depends on the day and the location. */
SunPath.prototype.updateDay = function () {
    if (!this.isActive()) return;

    const lat = this.home[0];
    const lng = this.home[1];
    this.dateControl.setDate(this.date);
    this.day = SolarAstronomy.getDayInfo(this.date, lat, lng);

    this.timeline.setDay(this.day);
    this.dataPanel.setDay(this.day);
    this.compass.setCenter(this.home);
    this.compass.setDayArc(SolarAstronomy.getDayArc(this.date, lat, lng, 1));
    this.compass.setYearRegions(SolarAstronomy.getSolsticeDates(this.date.getFullYear())
        .map(solstice => SolarAstronomy.getDayArc(solstice, lat, lng, 2)));
    this.updateMoment();
}

/** Recalculates everything that depends on the selected moment. */
SunPath.prototype.updateMoment = function () {
    if (!this.isActive()) return;

    const time = this.getTime();
    this.timeline.setFraction(this.fraction);
    this.compass.setSun(SolarAstronomy.getSample(time.getTime(), this.home[0], this.home[1]));
    this.shadow.setTime(time);
}

