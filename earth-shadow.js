/**
 * Darkens the part of the map where the sun is below the horizon.
 *
 * The map is scanned column by column. Within one column the longitude is
 * constant, so the latitudes of the shadow borders can be solved analytically
 * (see SolarAstronomy.getDarkLatitudeRanges). Night and civil twilight are
 * painted with two overlapping levels, which yields the soft border of the
 * terminator without any per pixel calculation.
 */
function EarthShadow(map) {
    MapCanvasOverlay.call(this, map, 'earth-shadow', 401);
    this.time = null;
}

EarthShadow.prototype = Object.create(MapCanvasOverlay.prototype);
EarthShadow.prototype.constructor = EarthShadow;

/** Width of one scan column in pixels. */
EarthShadow.COLUMN_WIDTH = 2;
/** Colour of the shadow; twilight gets one layer, night gets both. */
EarthShadow.SHADOW_COLOR = 'rgba(0, 6, 30, 0.11)';

/**
 * Sets the moment the shadow is drawn for.
 * @param {Date} time Moment of the calculation.
 */
EarthShadow.prototype.setTime = function (time) {
    this.time = time;
    this.redraw();
}

EarthShadow.prototype.draw = function (context, size) {
    if (!this.time) return;

    const degree = Math.PI / 180;
    const position = SolarAstronomy.getEquatorialPosition(this.time);
    const sinDeclination = Math.sin(position.declination);
    const cosDeclination = Math.cos(position.declination);
    const thresholds = [
        Math.sin(SolarAstronomy.SUNRISE_ALTITUDE * degree),
        Math.sin(SolarAstronomy.TWILIGHT_ALTITUDE * degree)
    ];

    // Every threshold is painted as one path, so overlapping columns of the same
    // level do not darken each other twice.
    const projection = this.getProjection(size);
    const paths = thresholds.map(() => []);
    for (let x = 0; x < size.x; x += EarthShadow.COLUMN_WIDTH) {
        const lng = projection.getLng(x + EarthShadow.COLUMN_WIDTH / 2);
        const hourAngle = position.siderealTime + lng * degree - position.rightAscension;
        const meridianFactor = cosDeclination * Math.cos(hourAngle);

        thresholds.forEach((threshold, level) => {
            const ranges = SolarAstronomy.getDarkLatitudeRanges(threshold, sinDeclination, meridianFactor);
            for (const range of ranges) {
                const rectangle = this.getRectangle(x, range, size, projection);
                if (rectangle) paths[level].push(rectangle);
            }
        });
    }

    context.fillStyle = EarthShadow.SHADOW_COLOR;
    for (const path of paths) {
        context.beginPath();
        for (const rectangle of path) context.rect(rectangle[0], rectangle[1], rectangle[2], rectangle[3]);
        context.fill();
    }
}

/**
 * Linear mapping between container coordinates and geographic coordinates.
 * In the web mercator projection the longitude is linear in x and the mercator
 * latitude is linear in y, so two reference points replace one projection call
 * per scan column.
 * @param {L.Point} size Size of the map container.
 * @returns {{getLng: function, getY: function}} Longitude in degrees, latitude in radians.
 */
EarthShadow.prototype.getProjection = function (size) {
    const west = this.map.containerPointToLatLng([0, 0]).lng;
    const east = this.map.containerPointToLatLng([size.x, 0]).lng;
    const equator = this.map.latLngToContainerPoint([0, west]).y;
    const scale = (this.map.latLngToContainerPoint([45, west]).y - equator)
        / Math.log(Math.tan(Math.PI / 4 + Math.PI / 8));

    return {
        getLng: (x) => west + (east - west) * x / size.x,
        getY: (latitude) => equator + scale * Math.log(Math.tan(Math.PI / 4 + latitude / 2))
    };
}

/**
 * Converts a latitude range of one column into a canvas rectangle.
 * @param {number} x Left border of the column in pixels.
 * @param {number[]} range Latitude range [south, north] in radians.
 * @param {L.Point} size Size of the map container.
 * @param {object} projection Projection as returned by getProjection().
 * @returns {number[]} Rectangle as [x, y, width, height] or null if not visible.
 */
EarthShadow.prototype.getRectangle = function (x, range, size, projection) {
    const limit = SolarAstronomy.MERCATOR_LIMIT * Math.PI / 180;
    const south = Math.max(range[0], -limit);
    const north = Math.min(range[1], limit);
    if (north <= south) return null;

    const top = Math.max(0, Math.floor(projection.getY(north)));
    const bottom = Math.min(size.y, Math.ceil(projection.getY(south)));
    if (bottom <= top) return null;

    return [x, top, EarthShadow.COLUMN_WIDTH, bottom - top];
}
