import { TypedEventEmitter } from '../core/TypedEventEmitter';
import type { MarkerLayerState } from './MarkerLayer';
import type { MapMarker } from './MarkerTypes';

interface MarkerListViewEvents extends Record<string, unknown[]> {
    /** A row was clicked; the map should centre on that marker. */
    markerselected: [marker: MapMarker];
    /** The H button of a row was pressed. */
    homeselected: [marker: MapMarker];
    /** The DEL button of a row was pressed. */
    markerdeleted: [id: number];
    /** The ADD button of the gps row was pressed. */
    locationadded: [marker: MapMarker];
}

/**
 * Table of all markers in the side menu.
 *
 * Each marker occupies two rows: the coordinates plus the distance to the home
 * marker, and a row with its buttons. The view is stateless, it renders whatever
 * the controller hands over and reports the user's intent as events.
 */
export class MarkerListView extends TypedEventEmitter<MarkerListViewEvents> {
    readonly #table: HTMLTableElement;

    /**
     * @param container Element the table is rendered into.
     * @param computeDistance Distance between two markers in metres.
     */
    constructor(
        container: HTMLElement,
        private readonly computeDistance: (from: MapMarker, to: MapMarker) => number
    ) {
        super();
        this.#table = document.createElement('table');
        container.appendChild(this.#table);
    }

    /**
     * Rebuilds the table.
     * @param state Markers to show.
     */
    render(state: MarkerLayerState): void {
        this.#table.replaceChildren(this.createHeader());

        if (state.location) {
            this.appendMarker(state, state.location, [
                { label: 'ADD', action: () => this.emit('locationadded', state.location!) },
                { label: 'H', action: () => this.emit('homeselected', state.location!) }
            ]);
        }
        for (const marker of state.markers) {
            this.appendMarker(state, marker, [
                { label: 'DEL', action: () => this.emit('markerdeleted', marker.id) },
                { label: 'H', action: () => this.emit('homeselected', marker) }
            ]);
        }
    }

    private createHeader(): HTMLTableRowElement {
        const header = document.createElement('tr');
        header.innerHTML = "<th style='width:10%'>#</th><th style='width:33%'>Lat</th>"
            + "<th style='width:33%'>Lng</th><th style='width:34%'>Entf</th>";
        return header;
    }

    /**
     * Appends the coordinate row and the button row of one marker.
     * @param state Current state, needed for the home marker and the distance.
     * @param marker Marker of the rows.
     * @param buttons Buttons of the second row.
     */
    private appendMarker(
        state: MarkerLayerState, marker: MapMarker,
        buttons: readonly { label: string; action: () => void }[]
    ): void {
        const isHome = state.home !== null && state.home.id === marker.id;

        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.appendChild(this.createIdCell(marker));
        row.appendChild(this.createValueCell(marker.lat.toFixed(6)));
        row.appendChild(this.createValueCell(marker.lng.toFixed(6)));
        row.appendChild(this.createValueCell(this.formatDistance(state.home, marker)));
        row.addEventListener('click', () => this.emit('markerselected', marker));

        const buttonRow = document.createElement('tr');
        buttonRow.classList.add('buttonRow');
        const buttonCell = document.createElement('td');
        buttonCell.colSpan = 3;
        for (const button of buttons) {
            const element = document.createElement('button');
            element.type = 'button';
            element.textContent = button.label;
            element.addEventListener('click', button.action);
            buttonCell.appendChild(element);
        }
        buttonRow.appendChild(buttonCell);

        if (isHome) {
            row.classList.add('homeRow');
            buttonRow.classList.add('homeRow');
        }
        this.#table.append(row, buttonRow);
    }

    private createIdCell(marker: MapMarker): HTMLTableCellElement {
        const cell = document.createElement('td');
        cell.rowSpan = 2;
        // Assigning the colour instead of interpolating it into markup keeps
        // colour values that come from the url out of the html.
        cell.style.color = marker.color;
        cell.textContent = `#${marker.id}`;
        return cell;
    }

    private createValueCell(text: string): HTMLTableCellElement {
        const cell = document.createElement('td');
        cell.className = 'position';
        cell.textContent = text;
        return cell;
    }

    /**
     * Distance of a marker to the home marker.
     * @param home Current home marker or null.
     * @param marker Marker of the row.
     * @returns Distance in metres or kilometres, a dash without a home marker.
     */
    private formatDistance(home: MapMarker | null, marker: MapMarker): string {
        if (!home || home.id === marker.id) return '-';
        const distance = this.computeDistance(home, marker);
        return distance >= 1000 ? `${(distance / 1000).toFixed(2)} km` : `${Math.round(distance)} m`;
    }
}
