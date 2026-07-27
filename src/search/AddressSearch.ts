import type { LatLngTuple } from '../core/Geo';
import { TypedEventEmitter } from '../core/TypedEventEmitter';

interface AddressSearchEvents extends Record<string, unknown[]> {
    /** A place matching the query was found. */
    found: [latlng: LatLngTuple];
}

/** One entry of a nominatim search response. */
interface NominatimResult {
    readonly lat: string;
    readonly lon: string;
}

/** Geocoding service used to resolve the entered address. */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Address search in the side menu. The entered text is resolved with nominatim
 * and the first hit is reported; errors are shown in the input field itself so
 * the small menu needs no extra message area.
 */
export class AddressSearch extends TypedEventEmitter<AddressSearchEvents> {
    /**
     * @param form Form element containing the input and the button.
     */
    constructor(private readonly form: HTMLFormElement) {
        super();
        this.form.addEventListener('submit', (event) => {
            event.preventDefault();
            void this.search();
        });
    }

    /** Resolves the entered address and reports the first hit. */
    async search(): Promise<void> {
        const input = this.form.elements.namedItem('ort');
        if (!(input instanceof HTMLInputElement)) return;

        const url = new URL(NOMINATIM_URL);
        url.search = new URLSearchParams({ q: input.value, format: 'json' }).toString();

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = (await response.json()) as NominatimResult[];
            const first = Array.isArray(data) ? data[0] : undefined;
            if (!first) throw new Error('Not found');

            input.value = '';
            this.emit('found', [parseFloat(first.lat), parseFloat(first.lon)]);
        } catch (error) {
            input.value = error instanceof Error ? error.message : String(error);
        }
    }
}
