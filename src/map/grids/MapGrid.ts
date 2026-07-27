import L from 'leaflet';

/** Line style shared by all grid implementations. */
export const GRID_LINE_STYLE: L.PolylineOptions = {
    stroke: true,
    color: '#111',
    opacity: 0.6,
    weight: 1,
    interactive: false
};

/**
 * Base class of the coordinate grids drawn on top of the map.
 *
 * Inspired by Leaflet.Grid (https://github.com/jieter/Leaflet.Grid) and
 * leaflet-grids (https://github.com/trailbehind/leaflet-grids), but implemented
 * as a plain class that owns a layer group instead of extending `L.LayerGroup`.
 * Composition keeps the leaflet typings intact and makes the redraw lifecycle
 * explicit.
 */
export abstract class MapGrid {
    protected readonly group = L.layerGroup();
    #map: L.Map | null = null;
    #spacing: number;
    readonly #redraw = () => this.redraw();

    /**
     * @param spacing Grid spacing in the unit of the concrete grid.
     */
    protected constructor(spacing: number) {
        this.#spacing = spacing;
    }

    /** Grid spacing in the unit of the concrete grid. */
    get spacing(): number {
        return this.#spacing;
    }

    /** The map the grid is attached to, or null while it is detached. */
    protected get map(): L.Map | null {
        return this.#map;
    }

    /**
     * Attaches the grid to a map and draws it.
     * @param map Target map.
     */
    addTo(map: L.Map): this {
        if (this.#map) this.remove();
        this.#map = map;
        this.group.addTo(map);
        map.on('viewreset move', this.#redraw);
        this.redraw();
        return this;
    }

    /** Detaches the grid from its map. */
    remove(): this {
        this.#map?.off('viewreset move', this.#redraw);
        this.group.clearLayers();
        this.group.remove();
        this.#map = null;
        return this;
    }

    /**
     * Changes the grid spacing and redraws.
     * @param spacing Spacing in the unit of the concrete grid.
     */
    setSpacing(spacing: number): void {
        this.#spacing = spacing;
        this.redraw();
    }

    /** Rebuilds all grid layers for the current view. */
    redraw(): void {
        const map = this.#map;
        if (!map) return;

        this.group.clearLayers();
        for (const layer of this.createLayers(map, map.getBounds())) {
            this.group.addLayer(layer);
        }
    }

    /**
     * Builds the lines and labels for the current view.
     * @param map Map the grid is attached to.
     * @param bounds Currently visible area.
     */
    protected abstract createLayers(map: L.Map, bounds: L.LatLngBounds): L.Layer[];

    /**
     * Creates a grid label.
     * @param latlng Anchor of the label.
     * @param text Label text.
     * @param cssClass Additional class, `lat` or `lng`.
     */
    protected createLabel(latlng: L.LatLngExpression, text: string, cssClass: string): L.Marker {
        return L.marker(latlng, {
            interactive: false,
            icon: L.divIcon({
                className: 'leaflet-grids-label',
                html: `<div class="grid-label ${cssClass}">${text}</div>`
            })
        });
    }
}
