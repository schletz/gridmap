// <script src="https://unpkg.com/suncalc@1.9.0/suncalc.js"></script>

/**
 * Stateless helpers for solar geometry, built on top of SunCalc.
 *
 * SunCalc.getTimes() returns invalid dates whenever the sun does not cross a
 * requested altitude (polar day, polar night, twilight that never ends), because
 * the underlying hour angle is undefined there. All event times in this module
 * are therefore derived by sampling the sun's altitude over the local day, which
 * stays valid at every latitude.
 *
 * Azimuth values are measured clockwise from north, altitudes above the
 * mathematical horizon. Unless stated otherwise angles are in radians.
 */
const SolarAstronomy = {
    /** Altitude of the sun's centre at sunrise/sunset (refraction + apparent radius) in degrees. */
    SUNRISE_ALTITUDE: -0.833,
    /** Altitude that separates civil twilight from night in degrees. */
    TWILIGHT_ALTITUDE: -6,
    /** Obliquity of the ecliptic in radians. */
    OBLIQUITY: 23.4397 * Math.PI / 180,
    /** Latitude limit of the web mercator projection in degrees. */
    MERCATOR_LIMIT: 85.0511
};

/**
 * Start and end of the local day the given date belongs to.
 * Both bounds are local midnight, so days with a daylight saving switch are
 * 23 or 25 hours long.
 * @param {Date} date Any moment within the wanted local day.
 * @returns {{start: Date, end: Date}}
 */
SolarAstronomy.getDayBounds = function (date) {
    return {
        start: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        end: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
    };
};

/**
 * Position of the sun for a single moment.
 * @param {number} time Timestamp in milliseconds.
 * @param {number} lat Latitude in degrees.
 * @param {number} lng Longitude in degrees.
 * @returns {{time: number, azimuth: number, altitude: number}}
 */
SolarAstronomy.getSample = function (time, lat, lng) {
    const position = SunCalc.getPosition(new Date(time), lat, lng);
    // SunCalc measures the azimuth from south, the compass azimuth starts at north.
    let azimuth = (position.azimuth + Math.PI) % (2 * Math.PI);
    if (azimuth < 0) azimuth += 2 * Math.PI;
    return { time: time, azimuth: azimuth, altitude: position.altitude };
};

/**
 * Samples azimuth and altitude of the sun over a whole local day.
 * @param {Date} date Any moment within the wanted local day.
 * @param {number} lat Latitude in degrees.
 * @param {number} lng Longitude in degrees.
 * @param {number} stepMinutes Sampling interval in minutes.
 * @returns {{start: Date, end: Date, samples: {time: number, azimuth: number, altitude: number}[]}}
 */
SolarAstronomy.sampleDay = function (date, lat, lng, stepMinutes) {
    const bounds = this.getDayBounds(date);
    const stepMs = stepMinutes * 60_000;
    const endTime = bounds.end.getTime();
    const samples = [];
    for (let time = bounds.start.getTime(); time < endTime; time += stepMs) {
        samples.push(this.getSample(time, lat, lng));
    }
    samples.push(this.getSample(endTime, lat, lng));
    return { start: bounds.start, end: bounds.end, samples: samples };
};

/**
 * Finds the first rise, the last set and the total time above a given altitude.
 * Crossings are interpolated linearly between two samples, which is accurate to
 * far below a second for a one minute sampling interval.
 * @param {{time: number, altitude: number}[]} samples Samples of one day.
 * @param {number} altitude Threshold altitude in radians.
 * @returns {{rise: Date, set: Date, durationMs: number, alwaysAbove: boolean, alwaysBelow: boolean}}
 */
SolarAstronomy.findEvents = function (samples, altitude) {
    let rise = null;
    let set = null;
    let durationMs = 0;
    let alwaysAbove = true;
    let alwaysBelow = true;

    for (let i = 0; i < samples.length; i++) {
        if (samples[i].altitude >= altitude) alwaysBelow = false; else alwaysAbove = false;
        if (i === 0) continue;

        const previous = samples[i - 1];
        const current = samples[i];
        const previousUp = previous.altitude >= altitude;
        const currentUp = current.altitude >= altitude;

        if (previousUp && currentUp) {
            durationMs += current.time - previous.time;
            continue;
        }
        if (!previousUp && !currentUp) continue;

        const crossing = previous.time + (current.time - previous.time)
            * (altitude - previous.altitude) / (current.altitude - previous.altitude);
        if (currentUp) {
            if (rise === null) rise = new Date(crossing);
            durationMs += current.time - crossing;
        } else {
            set = new Date(crossing);
            durationMs += crossing - previous.time;
        }
    }
    return { rise: rise, set: set, durationMs: durationMs, alwaysAbove: alwaysAbove, alwaysBelow: alwaysBelow };
};

/**
 * Highest position of the sun within the sampled day. The sample grid is refined
 * with the vertex of the parabola through the maximum and its two neighbours.
 * @param {{time: number, altitude: number}[]} samples Samples of one day.
 * @returns {{time: Date, altitude: number}}
 */
SolarAstronomy.findCulmination = function (samples) {
    let peak = 0;
    for (let i = 1; i < samples.length; i++) {
        if (samples[i].altitude > samples[peak].altitude) peak = i;
    }
    if (peak === 0 || peak === samples.length - 1) {
        return { time: new Date(samples[peak].time), altitude: samples[peak].altitude };
    }
    const before = samples[peak - 1].altitude;
    const center = samples[peak].altitude;
    const after = samples[peak + 1].altitude;
    const curvature = before - 2 * center + after;
    const offset = curvature === 0 ? 0 : 0.5 * (before - after) / curvature;
    const step = samples[peak + 1].time - samples[peak].time;
    return {
        time: new Date(samples[peak].time + offset * step),
        altitude: center - 0.25 * (before - after) * offset
    };
};

/**
 * All solar data of one local day at one location.
 * @param {Date} date Any moment within the wanted local day.
 * @param {number} lat Latitude in degrees.
 * @param {number} lng Longitude in degrees.
 * @returns {object} Sampled day plus the event times; times are null where the
 *                   sun does not cross the corresponding altitude.
 */
SolarAstronomy.getDayInfo = function (date, lat, lng) {
    const day = this.sampleDay(date, lat, lng, 1);
    const sun = this.findEvents(day.samples, this.SUNRISE_ALTITUDE * Math.PI / 180);
    const twilight = this.findEvents(day.samples, this.TWILIGHT_ALTITUDE * Math.PI / 180);
    const culmination = this.findCulmination(day.samples);

    return {
        start: day.start,
        end: day.end,
        samples: day.samples,
        dawn: twilight.rise,
        sunrise: sun.rise,
        solarNoon: culmination.time,
        maxAltitude: culmination.altitude,
        sunset: sun.set,
        dusk: twilight.set,
        dayLengthMs: sun.durationMs,
        // Latitudes with polar day/night or with twilight lasting the whole night.
        sunAlwaysUp: sun.alwaysAbove,
        sunAlwaysDown: sun.alwaysBelow,
        twilightAllNight: twilight.alwaysAbove,
        noTwilight: twilight.alwaysBelow
    };
};

/**
 * Interpolates the horizon crossing between two neighbouring samples.
 * @param {{azimuth: number, altitude: number}} before Sample on one side of the horizon.
 * @param {{azimuth: number, altitude: number}} after Sample on the other side.
 * @returns {{azimuth: number, altitude: number}} Point with altitude 0.
 */
SolarAstronomy.interpolateHorizon = function (before, after) {
    const factor = -before.altitude / (after.altitude - before.altitude);
    let delta = after.azimuth - before.azimuth;
    // The azimuth wraps around north, take the short way round.
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    return { azimuth: before.azimuth + delta * factor, altitude: 0 };
};

/**
 * Splits a sampled day into the contiguous runs where the sun is above the
 * horizon. Every run starts and ends exactly at altitude 0 unless the sun does
 * not set at all.
 * @param {{azimuth: number, altitude: number}[]} samples Samples of one day.
 * @returns {{azimuth: number, altitude: number}[][]} Day arc segments.
 */
SolarAstronomy.getDaylightSegments = function (samples) {
    const segments = [];
    let current = null;

    for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        if (sample.altitude >= 0) {
            if (current === null) {
                current = [];
                if (i > 0) current.push(this.interpolateHorizon(samples[i - 1], sample));
                segments.push(current);
            }
            current.push({ azimuth: sample.azimuth, altitude: sample.altitude });
        } else if (current !== null) {
            current.push(this.interpolateHorizon(samples[i - 1], sample));
            current = null;
        }
    }
    return segments;
};

/**
 * Day arc of the sun at one location.
 *
 * The arc is sampled over a full solar day (solar midnight to solar midnight)
 * instead of the local day of the user. Otherwise the daylight of a far away
 * location would be cut into two pieces by the local midnight. SunCalc's solar
 * noon is used as the centre because it is defined at every latitude.
 * @param {Date} date Day of the arc.
 * @param {number} lat Latitude in degrees.
 * @param {number} lng Longitude in degrees.
 * @param {number} stepMinutes Sampling interval in minutes.
 * @returns {object} Arc segments, the azimuths of sunrise and sunset (null if
 *                   the sun does not rise or set) and the polar day/night flags.
 */
SolarAstronomy.getDayArc = function (date, lat, lng, stepMinutes) {
    const noon = SunCalc.getTimes(date, lat, lng).solarNoon.getTime();
    const stepMs = stepMinutes * 60_000;
    const end = noon + 12 * 3600_000;
    const samples = [];
    let above = 0;
    for (let time = noon - 12 * 3600_000; time <= end; time += stepMs) {
        const sample = this.getSample(time, lat, lng);
        if (sample.altitude >= 0) above++;
        samples.push(sample);
    }

    const segments = this.getDaylightSegments(samples);
    const alwaysUp = above === samples.length;
    const alwaysDown = above === 0;
    const lastSegment = segments[segments.length - 1];
    return {
        segments: segments,
        alwaysUp: alwaysUp,
        alwaysDown: alwaysDown,
        sunriseAzimuth: alwaysUp || alwaysDown ? null : segments[0][0].azimuth,
        sunsetAzimuth: alwaysUp || alwaysDown ? null : lastSegment[lastSegment.length - 1].azimuth
    };
};

/**
 * Dates of the two solstices of a year. The declination changes by less than
 * 0.01° around the solstice, so the fixed nominal dates are precise enough for
 * the yearly range of the day arc.
 * @param {number} year Full year.
 * @returns {Date[]} June solstice and December solstice, both at local noon.
 */
SolarAstronomy.getSolsticeDates = function (year) {
    return [new Date(year, 5, 21, 12), new Date(year, 11, 21, 12)];
};

/**
 * Position of the sun in the equatorial system. The formulas match the ones used
 * by SunCalc, so altitudes derived from this frame are consistent with
 * SunCalc.getPosition().
 * @param {Date} date Moment of the observation.
 * @returns {{declination: number, rightAscension: number, siderealTime: number}} Angles in radians.
 */
SolarAstronomy.getEquatorialPosition = function (date) {
    const rad = Math.PI / 180;
    const days = date.valueOf() / 86_400_000 - 0.5 + 2440588 - 2451545;
    const meanAnomaly = rad * (357.5291 + 0.98560028 * days);
    const equationOfCenter = rad * (1.9148 * Math.sin(meanAnomaly)
        + 0.02 * Math.sin(2 * meanAnomaly)
        + 0.0003 * Math.sin(3 * meanAnomaly));
    // Perihelion of the earth plus 180° gives the ecliptic longitude of the sun.
    const eclipticLongitude = meanAnomaly + equationOfCenter + rad * 102.9372 + Math.PI;

    return {
        declination: Math.asin(Math.sin(eclipticLongitude) * Math.sin(this.OBLIQUITY)),
        rightAscension: Math.atan2(Math.sin(eclipticLongitude) * Math.cos(this.OBLIQUITY), Math.cos(eclipticLongitude)),
        siderealTime: rad * (280.16 + 360.9856235 * days)
    };
};

/**
 * Latitude ranges along one meridian where the sun is below a given altitude.
 *
 * Along a meridian the sine of the altitude is
 * sin(h) = sin(φ)·sin(δ) + cos(φ)·cos(δ)·cos(H) = K·sin(φ + ψ)
 * with K = hypot(a, b) and ψ = atan2(b, a). Solving that for the threshold gives
 * the shadow boundaries analytically, including the cases where the whole
 * meridian is lit or dark.
 * @param {number} sinAltitude Sine of the threshold altitude.
 * @param {number} a sin(δ) of the moment.
 * @param {number} b cos(δ)·cos(H) of the moment and the meridian.
 * @returns {number[][]} Disjoint [south, north] latitude ranges in radians.
 */
SolarAstronomy.getDarkLatitudeRanges = function (sinAltitude, a, b) {
    const pole = Math.PI / 2;
    const amplitude = Math.hypot(a, b);
    if (amplitude < 1e-12) return [[-pole, pole]];

    const ratio = sinAltitude / amplitude;
    if (ratio >= 1) return [[-pole, pole]];   // the sun stays below the threshold everywhere
    if (ratio <= -1) return [];               // the sun stays above the threshold everywhere

    const phase = Math.atan2(b, a);
    const root = Math.asin(ratio);
    // Lit where sin(φ + ψ) >= ratio, i.e. φ + ψ within [root, π - root] modulo 2π.
    const lit = [];
    for (let turn = -1; turn <= 1; turn++) {
        const from = Math.max(root - phase + turn * 2 * Math.PI, -pole);
        const to = Math.min(Math.PI - root - phase + turn * 2 * Math.PI, pole);
        if (to > from) lit.push([from, to]);
    }
    lit.sort((first, second) => first[0] - second[0]);

    const dark = [];
    let border = -pole;
    for (const range of lit) {
        if (range[0] > border) dark.push([border, range[0]]);
        border = Math.max(border, range[1]);
    }
    if (border < pole) dark.push([border, pole]);
    return dark;
};
