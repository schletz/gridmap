import L from 'leaflet';

/**
 * Base for canvas overlays that are attached to the map container instead of a
 * leaflet pane. Such a canvas stays fixed to the viewport, so everything can be
 * drawn in container coordinates and keeps its pixel size independent of the
 * zoom level. The canvas is repainted on every view change and is hidden while
 * the zoom animation runs, because container coordinates are not reliable then.
 *
 * Derived overlays implement draw(context, size).
 */
export abstract class MapCanvasOverlay {
    protected readonly canvas: HTMLCanvasElement;
    #visible = false;
    #zooming = false;

    /**
     * @param map Map the overlay belongs to.
     * @param className Css class of the canvas element.
     * @param zIndex Stacking order within the map container.
     */
    protected constructor(protected readonly map: L.Map, className: string, zIndex: number) {
        this.canvas = L.DomUtil.create('canvas', className);
        this.canvas.style.position = 'absolute';
        this.canvas.style.left = '0';
        this.canvas.style.top = '0';
        this.canvas.style.zIndex = `${zIndex}`;
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.display = 'none';
        map.getContainer().appendChild(this.canvas);

        map.on('move zoom resize viewreset', () => this.redraw());
        map.on('zoomstart', () => {
            this.#zooming = true;
            this.canvas.style.display = 'none';
        });
        map.on('zoomend', () => {
            this.#zooming = false;
            this.updateVisibility();
            this.redraw();
        });

        new ResizeObserver(() => this.redraw()).observe(map.getContainer());
    }

    /**
     * Shows or hides the overlay.
     * @param visible True to show the overlay.
     */
    setVisible(visible: boolean): void {
        this.#visible = visible;
        this.updateVisibility();
        this.redraw();
    }

    private updateVisibility(): void {
        this.canvas.style.display = this.#visible && !this.#zooming ? 'block' : 'none';
    }

    /** Adjusts the canvas to the map size and repaints it. */
    redraw(): void {
        if (!this.#visible || this.#zooming) return;

        const size = this.map.getSize();
        if (size.x === 0 || size.y === 0) return;

        const ratio = window.devicePixelRatio || 1;
        const width = Math.round(size.x * ratio);
        const height = Math.round(size.y * ratio);
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            this.canvas.style.width = `${size.x}px`;
            this.canvas.style.height = `${size.y}px`;
        }

        const context = this.canvas.getContext('2d');
        if (!context) return;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.clearRect(0, 0, size.x, size.y);
        this.draw(context, size);
    }

    /**
     * Paints the overlay content in container coordinates.
     * @param context Canvas context, already scaled to css pixels.
     * @param size Size of the map container in css pixels.
     */
    protected abstract draw(context: CanvasRenderingContext2D, size: L.Point): void;
}
