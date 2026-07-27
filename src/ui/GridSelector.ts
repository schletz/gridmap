import type L from 'leaflet';
import { DegreeGrid } from '../map/grids/DegreeGrid';
import type { MapGrid } from '../map/grids/MapGrid';
import { MetricGrid } from '../map/grids/MetricGrid';

/** One entry of the grid menu. */
export interface GridChoice {
    /** Label shown in the menu. */
    readonly title: string;
    /** Spacing in arc seconds for `degrees`, in metres for `metric`. */
    readonly spacing: number;
    readonly kind: 'degrees' | 'metric';
}

/** Grid spacings offered in the menu, from coarse to fine. */
export const GRID_CHOICES: readonly GridChoice[] = [
    { title: '10°', spacing: 36000, kind: 'degrees' },
    { title: '5°', spacing: 18000, kind: 'degrees' },
    { title: '1°', spacing: 3600, kind: 'degrees' },
    { title: '0.75°', spacing: 2700, kind: 'degrees' },
    { title: '0.5°', spacing: 1800, kind: 'degrees' },
    { title: '0.25°', spacing: 900, kind: 'degrees' },
    { title: '0.125°', spacing: 450, kind: 'degrees' },
    { title: '0.1°', spacing: 360, kind: 'degrees' },
    { title: "1'", spacing: 60, kind: 'degrees' },
    { title: '10"', spacing: 10, kind: 'degrees' },
    { title: "0.1'", spacing: 6, kind: 'degrees' },
    { title: '1"', spacing: 1, kind: 'degrees' }
];

/**
 * Menu block "Raster". It builds the list of spacings and keeps exactly one grid
 * on the map; picking a spacing of the same kind only changes the spacing
 * instead of rebuilding the layer.
 */
export class GridSelector {
    #grid: MapGrid | null = null;
    #kind: GridChoice['kind'] | null = null;

    /**
     * @param container Element the entries are rendered into.
     * @param map Map the grid is drawn on.
     * @param choices Entries of the menu.
     */
    constructor(container: HTMLElement, private readonly map: L.Map, choices = GRID_CHOICES) {
        for (const choice of choices) {
            const entry = document.createElement('div');
            entry.textContent = choice.title;
            entry.addEventListener('click', () => this.select(choice, entry));
            container.appendChild(entry);
        }
    }

    /**
     * Activates one spacing.
     * @param choice Selected entry.
     * @param entry Element of the entry, marked as the active one.
     */
    private select(choice: GridChoice, entry: HTMLElement): void {
        for (const sibling of entry.parentElement?.children ?? []) sibling.classList.remove('active');
        entry.classList.add('active');

        if (this.#grid && this.#kind === choice.kind) {
            this.#grid.setSpacing(choice.spacing);
            return;
        }
        this.#grid?.remove();
        this.#grid = choice.kind === 'degrees' ? new DegreeGrid(choice.spacing) : new MetricGrid(choice.spacing);
        this.#kind = choice.kind;
        this.#grid.addTo(this.map);
    }
}
