import L from 'leaflet';
import { TypedEventEmitter } from '../core/TypedEventEmitter';

interface OptionsMenuEvents extends Record<string, unknown[]> {
    /** The menu was shown or hidden; the map area changed its size. */
    toggled: [visible: boolean];
}

/**
 * Show/hide toggle of the side menu. The button lives inside the map container
 * so it stays below the zoom controls, therefore its click must not reach the
 * map underneath.
 */
export class OptionsMenu extends TypedEventEmitter<OptionsMenuEvents> {
    /**
     * @param menu The side menu itself.
     * @param button Button that toggles the menu.
     */
    constructor(private readonly menu: HTMLElement, button: HTMLButtonElement) {
        super();
        L.DomEvent.disableClickPropagation(button);
        button.addEventListener('click', () => {
            const visible = this.menu.classList.toggle('hidden') === false;
            button.textContent = visible ? '◄' : '►';
            this.emit('toggled', visible);
        });
    }
}
