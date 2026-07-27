import SunCalc from 'suncalc';
import { toRadians } from '../core/Geo';

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

/** Altitude of the sun's centre at sunrise/sunset (refraction + apparent radius) in degrees. */
export const SUNRISE_ALTITUDE = -0.833;
/** Altitude that separates civil twilight from night in degrees. */
export const TWILIGHT_ALTITUDE = -6;
/** Obliquity of the ecliptic in radians. */
export const OBLIQUITY = toRadians(23.4397);
/** Latitude limit of the web mercator projection in degrees. */
export const MERCATOR_LIMIT = 85.0511;

/** Position of the sun at one moment. */
export interface SolarSample {
    /** Timestamp in milliseconds. */
    readonly time: number;
    /** Azimuth clockwise from north in radians. */
    readonly azimuth: number;
    /** Altitude above the horizon in radians. */
    readonly altitude: number;
}

/** A point of the day arc on the bearing circle. */
export interface SkyPoint {
    readonly azimuth: number;
    readonly altitude: number;
}

/** Rise, set and duration for one altitude threshold. */
export interface SolarEvents {
    readonly rise: Date | null;
    readonly set: Date | null;
    readonly durationMs: number;
    readonly alwaysAbove: boolean;
    readonly alwaysBelow: boolean;
}

/** Everything that is known about one local day at one location. */
export interface SolarDayInfo {
    readonly start: Date;
    readonly end: Date;
    readonly samples: readonly SolarSample[];
    readonly dawn: Date | null;
    readonly sunrise: Date | null;
    readonly solarNoon: Date;
    readonly maxAltitude: number;
    readonly sunset: Date | null;
    readonly dusk: Date | null;
    readonly dayLengthMs: number;
    /** Polar day: the sun stays above the horizon all day. */
    readonly sunAlwaysUp: boolean;
    /** Polar night: the sun stays below the horizon all day. */
    readonly sunAlwaysDown: boolean;
    /** The twilight lasts through the whole night. */
    readonly twilightAllNight: boolean;
    /** The sun never even reaches the twilight altitude. */
    readonly noTwilight: boolean;
}

/** Path of the sun over one solar day. */
export interface SolarDayArc {
    /** Contiguous runs above the horizon; every run starts and ends at altitude 0. */
    readonly segments: readonly (readonly SkyPoint[])[];
    readonly alwaysUp: boolean;
    readonly alwaysDown: boolean;
    /** Azimuth of sunrise, null if the sun does not rise or set. */
    readonly sunriseAzimuth: number | null;
    /** Azimuth of sunset, null if the sun does not rise or set. */
    readonly sunsetAzimuth: number | null;
}

/** Position of the sun in the equatorial system, all angles in radians. */
export interface EquatorialPosition {
    readonly declination: number;
    readonly rightAscension: number;
    readonly siderealTime: number;
}

/**
 * Start and end of the local day the given date belongs to.
 * Both bounds are local midnight, so days with a daylight saving switch are
 * 23 or 25 hours long.
 * @param date Any moment within the wanted local day.
 */
export function getDayBounds(date: Date): { start: Date; end: Date } {
    return {
        start: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        end: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
    };
}

/**
 * Position of the sun for a single moment.
 * @param time Timestamp in milliseconds.
 * @param lat Latitude in degrees.
 * @param lng Longitude in degrees.
 */
export function getSample(time: number, lat: number, lng: number): SolarSample {
    const position = SunCalc.getPosition(new Date(time), lat, lng);
    // SunCalc measures the azimuth from south, the compass azimuth starts at north.
    let azimuth = (position.azimuth + Math.PI) % (2 * Math.PI);
    if (azimuth < 0) azimuth += 2 * Math.PI;
    return { time, azimuth, altitude: position.altitude };
}

/**
 * Samples azimuth and altitude of the sun over a whole local day.
 * @param date Any moment within the wanted local day.
 * @param lat Latitude in degrees.
 * @param lng Longitude in degrees.
 * @param stepMinutes Sampling interval in minutes.
 */
export function sampleDay(
    date: Date, lat: number, lng: number, stepMinutes: number
): { start: Date; end: Date; samples: SolarSample[] } {
    const bounds = getDayBounds(date);
    const stepMs = stepMinutes * 60_000;
    const endTime = bounds.end.getTime();
    const samples: SolarSample[] = [];
    for (let time = bounds.start.getTime(); time < endTime; time += stepMs) {
        samples.push(getSample(time, lat, lng));
    }
    samples.push(getSample(endTime, lat, lng));
    return { start: bounds.start, end: bounds.end, samples };
}

/**
 * Finds the first rise, the last set and the total time above a given altitude.
 * Crossings are interpolated linearly between two samples, which is accurate to
 * far below a second for a one minute sampling interval.
 * @param samples Samples of one day.
 * @param altitude Threshold altitude in radians.
 */
export function findEvents(samples: readonly SolarSample[], altitude: number): SolarEvents {
    let rise: Date | null = null;
    let set: Date | null = null;
    let durationMs = 0;
    let alwaysAbove = true;
    let alwaysBelow = true;

    for (let i = 0; i < samples.length; i++) {
        const current = samples[i]!;
        if (current.altitude >= altitude) alwaysBelow = false; else alwaysAbove = false;
        if (i === 0) continue;

        const previous = samples[i - 1]!;
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
    return { rise, set, durationMs, alwaysAbove, alwaysBelow };
}

/**
 * Highest position of the sun within the sampled day. The sample grid is refined
 * with the vertex of the parabola through the maximum and its two neighbours.
 * @param samples Samples of one day.
 */
export function findCulmination(samples: readonly SolarSample[]): { time: Date; altitude: number } {
    let peak = 0;
    for (let i = 1; i < samples.length; i++) {
        if (samples[i]!.altitude > samples[peak]!.altitude) peak = i;
    }
    if (peak === 0 || peak === samples.length - 1) {
        return { time: new Date(samples[peak]!.time), altitude: samples[peak]!.altitude };
    }
    const before = samples[peak - 1]!.altitude;
    const center = samples[peak]!.altitude;
    const after = samples[peak + 1]!.altitude;
    const curvature = before - 2 * center + after;
    const offset = curvature === 0 ? 0 : 0.5 * (before - after) / curvature;
    const step = samples[peak + 1]!.time - samples[peak]!.time;
    return {
        time: new Date(samples[peak]!.time + offset * step),
        altitude: center - 0.25 * (before - after) * offset
    };
}

/**
 * All solar data of one local day at one location. Times are null where the sun
 * does not cross the corresponding altitude.
 * @param date Any moment within the wanted local day.
 * @param lat Latitude in degrees.
 * @param lng Longitude in degrees.
 */
export function getDayInfo(date: Date, lat: number, lng: number): SolarDayInfo {
    const day = sampleDay(date, lat, lng, 1);
    const sun = findEvents(day.samples, toRadians(SUNRISE_ALTITUDE));
    const twilight = findEvents(day.samples, toRadians(TWILIGHT_ALTITUDE));
    const culmination = findCulmination(day.samples);

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
}

/**
 * Interpolates the horizon crossing between two neighbouring samples.
 * @param before Sample on one side of the horizon.
 * @param after Sample on the other side.
 * @returns Point with altitude 0.
 */
export function interpolateHorizon(before: SolarSample, after: SolarSample): SkyPoint {
    const factor = -before.altitude / (after.altitude - before.altitude);
    let delta = after.azimuth - before.azimuth;
    // The azimuth wraps around north, take the short way round.
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    return { azimuth: before.azimuth + delta * factor, altitude: 0 };
}

/**
 * Splits a sampled day into the contiguous runs where the sun is above the
 * horizon. Every run starts and ends exactly at altitude 0 unless the sun does
 * not set at all.
 * @param samples Samples of one day.
 */
export function getDaylightSegments(samples: readonly SolarSample[]): SkyPoint[][] {
    const segments: SkyPoint[][] = [];
    let current: SkyPoint[] | null = null;

    for (let i = 0; i < samples.length; i++) {
        const sample = samples[i]!;
        if (sample.altitude >= 0) {
            if (current === null) {
                current = [];
                if (i > 0) current.push(interpolateHorizon(samples[i - 1]!, sample));
                segments.push(current);
            }
            current.push({ azimuth: sample.azimuth, altitude: sample.altitude });
        } else if (current !== null) {
            current.push(interpolateHorizon(samples[i - 1]!, sample));
            current = null;
        }
    }
    return segments;
}

/**
 * Day arc of the sun at one location.
 *
 * The arc is sampled over a full solar day (solar midnight to solar midnight)
 * instead of the local day of the user. Otherwise the daylight of a far away
 * location would be cut into two pieces by the local midnight. SunCalc's solar
 * noon is used as the centre because it is defined at every latitude.
 * @param date Day of the arc.
 * @param lat Latitude in degrees.
 * @param lng Longitude in degrees.
 * @param stepMinutes Sampling interval in minutes.
 */
export function getDayArc(date: Date, lat: number, lng: number, stepMinutes: number): SolarDayArc {
    const noon = SunCalc.getTimes(date, lat, lng).solarNoon.getTime();
    const stepMs = stepMinutes * 60_000;
    const end = noon + 12 * 3_600_000;
    const samples: SolarSample[] = [];
    let above = 0;
    for (let time = noon - 12 * 3_600_000; time <= end; time += stepMs) {
        const sample = getSample(time, lat, lng);
        if (sample.altitude >= 0) above++;
        samples.push(sample);
    }

    const segments = getDaylightSegments(samples);
    const alwaysUp = above === samples.length;
    const alwaysDown = above === 0;
    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1];
    const undefinedAzimuth = alwaysUp || alwaysDown || !firstSegment || !lastSegment;
    return {
        segments,
        alwaysUp,
        alwaysDown,
        sunriseAzimuth: undefinedAzimuth ? null : firstSegment[0]!.azimuth,
        sunsetAzimuth: undefinedAzimuth ? null : lastSegment[lastSegment.length - 1]!.azimuth
    };
}

/**
 * Dates of the two solstices of a year. The declination changes by less than
 * 0.01° around the solstice, so the fixed nominal dates are precise enough for
 * the yearly range of the day arc.
 * @param year Full year.
 * @returns June solstice and December solstice, both at local noon.
 */
export function getSolsticeDates(year: number): Date[] {
    return [new Date(year, 5, 21, 12), new Date(year, 11, 21, 12)];
}

/**
 * Position of the sun in the equatorial system. The formulas match the ones used
 * by SunCalc, so altitudes derived from this frame are consistent with
 * SunCalc.getPosition().
 * @param date Moment of the observation.
 */
export function getEquatorialPosition(date: Date): EquatorialPosition {
    const days = date.valueOf() / 86_400_000 - 0.5 + 2440588 - 2451545;
    const meanAnomaly = toRadians(357.5291 + 0.98560028 * days);
    const equationOfCenter = toRadians(1.9148 * Math.sin(meanAnomaly)
        + 0.02 * Math.sin(2 * meanAnomaly)
        + 0.0003 * Math.sin(3 * meanAnomaly));
    // Perihelion of the earth plus 180° gives the ecliptic longitude of the sun.
    const eclipticLongitude = meanAnomaly + equationOfCenter + toRadians(102.9372) + Math.PI;

    return {
        declination: Math.asin(Math.sin(eclipticLongitude) * Math.sin(OBLIQUITY)),
        rightAscension: Math.atan2(Math.sin(eclipticLongitude) * Math.cos(OBLIQUITY), Math.cos(eclipticLongitude)),
        siderealTime: toRadians(280.16 + 360.9856235 * days)
    };
}

/**
 * Latitude ranges along one meridian where the sun is below a given altitude.
 *
 * Along a meridian the sine of the altitude is
 * sin(h) = sin(φ)·sin(δ) + cos(φ)·cos(δ)·cos(H) = K·sin(φ + ψ)
 * with K = hypot(a, b) and ψ = atan2(b, a). Solving that for the threshold gives
 * the shadow boundaries analytically, including the cases where the whole
 * meridian is lit or dark.
 * @param sinAltitude Sine of the threshold altitude.
 * @param a sin(δ) of the moment.
 * @param b cos(δ)·cos(H) of the moment and the meridian.
 * @returns Disjoint [south, north] latitude ranges in radians.
 */
export function getDarkLatitudeRanges(sinAltitude: number, a: number, b: number): [number, number][] {
    const pole = Math.PI / 2;
    const amplitude = Math.hypot(a, b);
    if (amplitude < 1e-12) return [[-pole, pole]];

    const ratio = sinAltitude / amplitude;
    if (ratio >= 1) return [[-pole, pole]];   // the sun stays below the threshold everywhere
    if (ratio <= -1) return [];               // the sun stays above the threshold everywhere

    const phase = Math.atan2(b, a);
    const root = Math.asin(ratio);
    // Lit where sin(φ + ψ) >= ratio, i.e. φ + ψ within [root, π - root] modulo 2π.
    const lit: [number, number][] = [];
    for (let turn = -1; turn <= 1; turn++) {
        const from = Math.max(root - phase + turn * 2 * Math.PI, -pole);
        const to = Math.min(Math.PI - root - phase + turn * 2 * Math.PI, pole);
        if (to > from) lit.push([from, to]);
    }
    lit.sort((first, second) => first[0] - second[0]);

    const dark: [number, number][] = [];
    let border = -pole;
    for (const range of lit) {
        if (range[0] > border) dark.push([border, range[0]]);
        border = Math.max(border, range[1]);
    }
    if (border < pole) dark.push([border, pole]);
    return dark;
}
