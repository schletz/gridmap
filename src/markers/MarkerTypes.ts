/** A marker on the map. */
export interface MapMarker {
    /** Number shown in the icon; 0 is reserved for the gps position. */
    readonly id: number;
    readonly lat: number;
    readonly lng: number;
    /** Css colour of the icon, the connection line and the distance circles. */
    readonly color: string;
}

/** The current gps position. It always carries the id 0 and a heading. */
export interface LocationMarker extends MapMarker {
    readonly id: 0;
    /** Heading of the device in degrees, used to rotate the arrow icon. */
    readonly angle: number;
}

/** Colours assigned to new markers in the order they are created. */
export const MARKER_COLORS: readonly string[] =
    ['red', 'green', 'blue', '#b36b00', 'purple', 'brown', '#000099', 'black'];

/** Colour of the gps position marker. */
export const LOCATION_COLOR = '#007bff';
