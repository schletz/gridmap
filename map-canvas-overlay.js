/**
 * Base for canvas overlays that are attached to the map container instead of a
 * leaflet pane. Such a canvas stays fixed to the viewport, so everything can be
 * drawn in container coordinates and keeps its pixel size independent of the
 * zoom level. The canvas is repainted on every view change and is hidden while
 * the zoom animation runs, because container coordinates are not reliable then.
 *
 * Derived overlays implement draw(context, size).
 */
function MapCanvasOverlay(map, className, zIndex) {
    const overlay = this;
    overlay.map = map;
    overlay.visible = false;
    overlay.zooming = false;

    overlay.canvas = L.DomUtil.create('canvas', className);
    overlay.canvas.style.position = 'absolute';
    overlay.canvas.style.left = '0';
    overlay.canvas.style.top = '0';
    overlay.canvas.style.zIndex = zIndex;
    overlay.canvas.style.pointerEvents = 'none';
    overlay.canvas.style.display = 'none';
    map.getContainer().appendChild(overlay.canvas);

    map.on('move zoom resize viewreset', () => overlay.redraw());
    map.on('zoomstart', () => {
        overlay.zooming = true;
        overlay.canvas.style.display = 'none';
    });
    map.on('zoomend', () => {
        overlay.zooming = false;
        overlay.updateVisibility();
        overlay.redraw();
    });

    new ResizeObserver(() => overlay.redraw()).observe(map.getContainer());
}

/**
 * Shows or hides the overlay.
 * @param {boolean} visible True to show the overlay.
 */
MapCanvasOverlay.prototype.setVisible = function (visible) {
    this.visible = visible;
    this.updateVisibility();
    this.redraw();
}

MapCanvasOverlay.prototype.updateVisibility = function () {
    this.canvas.style.display = this.visible && !this.zooming ? 'block' : 'none';
}

/** Adjusts the canvas to the map size and repaints it. */
MapCanvasOverlay.prototype.redraw = function () {
    if (!this.visible || this.zooming) return;

    const size = this.map.getSize();
    if (size.x === 0 || size.y === 0) return;

    const ratio = window.devicePixelRatio || 1;
    if (this.canvas.width !== Math.round(size.x * ratio) || this.canvas.height !== Math.round(size.y * ratio)) {
        this.canvas.width = Math.round(size.x * ratio);
        this.canvas.height = Math.round(size.y * ratio);
        this.canvas.style.width = `${size.x}px`;
        this.canvas.style.height = `${size.y}px`;
    }

    const context = this.canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, size.x, size.y);
    this.draw(context, size);
}

/**
 * Paints the overlay content in container coordinates.
 * @param {CanvasRenderingContext2D} context Canvas context, already scaled to css pixels.
 * @param {L.Point} size Size of the map container in css pixels.
 */
MapCanvasOverlay.prototype.draw = function (context, size) { }
