import type { MapMarker } from './MarkerTypes';

/** Query parameter that carries an exported marker set. */
export const MARKER_QUERY_PARAMETER = 'setMarkers';

/**
 * Encoding of a marker set in the query string, used by the QR code export.
 *
 * One marker is written as `id_color_lat_lng`, coordinates as integer
 * microdegrees, markers separated by `$`. Hash signs of html colour values are
 * escaped because they would otherwise start the url fragment.
 *
 * @example ?setMarkers=1_red_47820532_10892944$2_green_47720849_11771851
 */
export class MarkerUrlCodec {
    /**
     * Colour values from the url end up in markup, therefore only plain colour
     * names and hex values are accepted.
     */
    static readonly #COLOR_PATTERN = /^#?[0-9a-zA-Z]{3,20}$/;

    /**
     * Encodes a marker set for the query string.
     * @param markers Markers to encode.
     */
    static encode(markers: readonly MapMarker[]): string {
        return markers
            .map(marker => `${marker.id}_${marker.color}`
                + `_${Math.round(1_000_000 * marker.lat)}_${Math.round(1_000_000 * marker.lng)}`)
            .map(text => text.replace('#', '%23'))
            .join('$');
    }

    /**
     * Decodes a marker set. Malformed entries are skipped instead of producing
     * markers with NaN coordinates.
     * @param data Value of the query parameter.
     * @returns Markers sorted by id.
     */
    static decode(data: string): MapMarker[] {
        const markers: MapMarker[] = [];
        for (const entry of data.replaceAll('%23', '#').split('$')) {
            const parts = entry.split('_');
            if (parts.length !== 4) continue;
            const id = Number(parts[0]);
            const color = parts[1]!;
            const lat = Number(parts[2]) / 1_000_000;
            const lng = Number(parts[3]) / 1_000_000;
            if (!Number.isFinite(id) || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
            if (!MarkerUrlCodec.#COLOR_PATTERN.test(color)) continue;
            markers.push({ id, lat, lng, color });
        }
        return markers.sort((first, second) => first.id - second.id);
    }
}
