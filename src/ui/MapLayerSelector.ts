import L from 'leaflet';
import { MAP_LAYERS, type MapLayerDefinition } from '../map/MapLayerCatalog';

/**
 * Menu block "Karten". It builds the list of base maps and makes sure that
 * exactly one of them is on the map. The tile layers are created lazily, so
 * switching back to a map that was shown before keeps its cached tiles.
 */
export class MapLayerSelector {
    readonly #layers = new Map<MapLayerDefinition, L.TileLayer>();
    #current: L.TileLayer | null = null;

    /**
     * @param container Element the entries are rendered into.
     * @param map Map the tile layers are added to.
     * @param definitions Base maps of the menu.
     */
    constructor(container: HTMLElement, private readonly map: L.Map, definitions = MAP_LAYERS) {
        definitions.forEach((definition, index) => {
            const entry = document.createElement('div');
            entry.textContent = definition.title;
            entry.addEventListener('click', () => this.select(definition, entry));
            container.appendChild(entry);
            if (index === 0) this.select(definition, entry);
        });
    }

    /**
     * Shows one base map.
     * @param definition Selected base map.
     * @param entry Element of the entry, marked as the active one.
     */
    private select(definition: MapLayerDefinition, entry: HTMLElement): void {
        for (const sibling of entry.parentElement?.children ?? []) sibling.classList.remove('active');
        entry.classList.add('active');

        let layer = this.#layers.get(definition);
        if (!layer) {
            layer = L.tileLayer(definition.url, definition.options);
            this.#layers.set(definition, layer);
        }
        if (layer === this.#current) return;

        this.#current?.remove();
        layer.addTo(this.map);
        this.#current = layer;
    }
}
