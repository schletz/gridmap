/** Position as [latitude, longitude] in degrees. */
export type LatLngTuple = readonly [lat: number, lng: number];

/** Mean radius of the earth in metres. */
export const EARTH_RADIUS = 6_371_000;

/** Converts degrees to radians. */
export const toRadians = (degrees: number): number => degrees * Math.PI / 180;

/** Converts radians to degrees. */
export const toDegrees = (radians: number): number => radians * 180 / Math.PI;
