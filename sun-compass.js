/**
 * Bearing circle ("Peilkreis") with the day arc of the sun, drawn on top of the
 * map around the home location.
 *
 * The sky is mapped orthographically onto the circle: a point with the altitude h
 * is drawn at the distance radius·cos(h) from the centre, so the horizon lies on
 * the circle and the zenith in its centre. The circle keeps a fixed pixel size
 * and is fitted into the map container.
 */
function SunCompass(map) {
    MapCanvasOverlay.call(this, map, 'sun-compass', 402);
    this.center = null;
    this.arc = null;
    this.yearRegions = [];
    this.sun = null;
}

SunCompass.prototype = Object.create(MapCanvasOverlay.prototype);
SunCompass.prototype.constructor = SunCompass;

/** Distance in pixels between the bearing circle and the border of the map. */
SunCompass.PADDING = 30;

SunCompass.COLORS = {
    circle: 'rgba(40, 50, 70, 0.85)',
    crosshair: 'rgba(40, 50, 70, 0.35)',
    yearRange: 'rgba(255, 200, 0, 0.18)',
    sunrise: '#ffac11',
    sunset: '#d6604a',
    dayArc: '#ffd51e',
    sunRay: '#ffc80a',
    sun: '#fe8008',
    sunBelowHorizon: '#9aa0a6',
    label: '#26324a'
};

/**
 * Sets the location the circle is centred on.
 * @param {number[]} latlng Home position as [lat, lng] or null.
 */
SunCompass.prototype.setCenter = function (latlng) {
    this.center = latlng;
    this.redraw();
}

/**
 * Sets the day arc of the selected day.
 * @param {object} arc Segments of the day arc plus the azimuths of sunrise and
 *                     sunset in radians (null if the sun does not rise or set).
 */
SunCompass.prototype.setDayArc = function (arc) {
    this.arc = arc;
    this.redraw();
}

/**
 * Sets the two solstice arcs that enclose the range the sun covers over the year.
 * @param {object[]} regions Descriptors with segments, alwaysUp and alwaysDown.
 */
SunCompass.prototype.setYearRegions = function (regions) {
    this.yearRegions = regions;
    this.redraw();
}

/**
 * Sets the current position of the sun.
 * @param {{azimuth: number, altitude: number}} sun Position in radians.
 */
SunCompass.prototype.setSun = function (sun) {
    this.sun = sun;
    this.redraw();
}

/**
 * Converts a sky position into a canvas point.
 * @param {L.Point} center Centre of the circle in container coordinates.
 * @param {number} radius Radius of the circle in pixels.
 * @param {number} azimuth Azimuth clockwise from north in radians.
 * @param {number} altitude Altitude above the horizon in radians; values below
 *                          the horizon are drawn slightly outside the circle.
 * @returns {number[]} Point as [x, y].
 */
SunCompass.prototype.getPoint = function (center, radius, azimuth, altitude) {
    const distance = altitude >= 0 ? radius * Math.cos(altitude) : radius + 7;
    return [center.x + Math.sin(azimuth) * distance, center.y - Math.cos(azimuth) * distance];
}

SunCompass.prototype.draw = function (context, size) {
    if (!this.center) return;

    const center = this.map.latLngToContainerPoint(this.center);
    const radius = Math.min(size.x, size.y) / 2 - SunCompass.PADDING;
    if (radius <= 0) return;

    this.drawYearRange(context, center, radius);
    this.drawCircle(context, center, radius);
    this.drawHorizonLines(context, center, radius);
    this.drawDayArc(context, center, radius);
    this.drawSun(context, center, radius);
    this.drawLabels(context, center, radius);
}

/**
 * Fills the area the sun sweeps over the year. Both solstice arcs are added as
 * closed regions "below" the arc; the even-odd rule then fills exactly the area
 * between the June and the December arc, whichever of them runs higher.
 */
SunCompass.prototype.drawYearRange = function (context, center, radius) {
    if (this.yearRegions.length === 0) return;

    context.beginPath();
    for (const region of this.yearRegions) {
        this.appendRegion(context, region, center, radius);
    }
    context.fillStyle = SunCompass.COLORS.yearRange;
    context.fill('evenodd');
}

/**
 * Appends the area between the centre of the circle and one day arc as a closed
 * sub path. Where the sun does not reach a direction on that day the horizon
 * circle is used as the boundary.
 */
SunCompass.prototype.appendRegion = function (context, region, center, radius) {
    if (region.alwaysDown) {
        context.moveTo(center.x + radius, center.y);
        context.arc(center.x, center.y, radius, 0, 2 * Math.PI);
        return;
    }
    const points = this.getLongestSegment(region.segments);
    if (!points) return;

    let turning = 0;
    for (let i = 1; i < points.length; i++) {
        let delta = points[i].azimuth - points[i - 1].azimuth;
        if (delta > Math.PI) delta -= 2 * Math.PI;
        if (delta < -Math.PI) delta += 2 * Math.PI;
        turning += delta;
    }

    points.forEach((point, index) => {
        const target = this.getPoint(center, radius, point.azimuth, point.altitude);
        if (index === 0) context.moveTo(target[0], target[1]); else context.lineTo(target[0], target[1]);
    });
    if (!region.alwaysUp) {
        // Close the region along the horizon, continuing in the direction the sun moves.
        const quarter = Math.PI / 2;
        context.arc(center.x, center.y, radius,
            points[points.length - 1].azimuth - quarter, points[0].azimuth - quarter, turning < 0);
    }
    context.closePath();
}

SunCompass.prototype.getLongestSegment = function (segments) {
    let longest = null;
    for (const segment of segments) {
        if (segment.length >= 2 && (!longest || segment.length > longest.length)) longest = segment;
    }
    return longest;
}

SunCompass.prototype.drawCircle = function (context, center, radius) {
    context.save();
    context.setLineDash([6, 6]);
    context.strokeStyle = SunCompass.COLORS.crosshair;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(center.x - radius, center.y);
    context.lineTo(center.x + radius, center.y);
    context.moveTo(center.x, center.y - radius);
    context.lineTo(center.x, center.y + radius);
    context.stroke();
    context.restore();

    context.beginPath();
    context.arc(center.x, center.y, radius, 0, 2 * Math.PI);
    context.strokeStyle = SunCompass.COLORS.circle;
    context.lineWidth = 1.5;
    context.stroke();
}

/** Draws the lines from the centre to the azimuth of sunrise and sunset. */
SunCompass.prototype.drawHorizonLines = function (context, center, radius) {
    if (!this.arc) return;

    const lines = [
        { azimuth: this.arc.sunriseAzimuth, color: SunCompass.COLORS.sunrise },
        { azimuth: this.arc.sunsetAzimuth, color: SunCompass.COLORS.sunset }
    ];
    context.lineWidth = 5;
    context.lineCap = 'round';
    for (const line of lines) {
        if (line.azimuth === null || line.azimuth === undefined) continue;
        const end = this.getPoint(center, radius, line.azimuth, 0);
        context.beginPath();
        context.moveTo(center.x, center.y);
        context.lineTo(end[0], end[1]);
        context.strokeStyle = line.color;
        context.stroke();
    }
}

/** Draws the arc the sun follows on the selected day. */
SunCompass.prototype.drawDayArc = function (context, center, radius) {
    if (!this.arc) return;

    context.beginPath();
    for (const segment of this.arc.segments) {
        segment.forEach((point, index) => {
            const target = this.getPoint(center, radius, point.azimuth, point.altitude);
            if (index === 0) context.moveTo(target[0], target[1]); else context.lineTo(target[0], target[1]);
        });
    }
    context.strokeStyle = SunCompass.COLORS.dayArc;
    context.lineWidth = 3;
    context.stroke();
}

/** Draws the direction of the sun and the sun symbol itself. */
SunCompass.prototype.drawSun = function (context, center, radius) {
    if (!this.sun) return;

    const aboveHorizon = this.sun.altitude >= 0;
    const color = aboveHorizon ? SunCompass.COLORS.sun : SunCompass.COLORS.sunBelowHorizon;
    const position = this.getPoint(center, radius, this.sun.azimuth, this.sun.altitude);

    context.beginPath();
    context.moveTo(center.x, center.y);
    context.lineTo(position[0], position[1]);
    context.strokeStyle = aboveHorizon ? SunCompass.COLORS.sunRay : color;
    context.lineWidth = 6;
    context.lineCap = 'round';
    context.stroke();

    context.beginPath();
    context.arc(position[0], position[1], 11, 0, 2 * Math.PI);
    context.fillStyle = color;
    context.fill();
    context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    context.lineWidth = 1.5;
    context.stroke();
}

SunCompass.prototype.drawLabels = function (context, center, radius) {
    const labels = [{ text: 'N', azimuth: 0 }, { text: 'O', azimuth: Math.PI / 2 },
    { text: 'S', azimuth: Math.PI }, { text: 'W', azimuth: 3 * Math.PI / 2 }];

    context.font = 'bold 14px "Arial Narrow", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineWidth = 3;
    context.strokeStyle = 'white';
    context.fillStyle = SunCompass.COLORS.label;
    for (const label of labels) {
        const x = center.x + Math.sin(label.azimuth) * (radius + 14);
        const y = center.y - Math.cos(label.azimuth) * (radius + 14);
        context.strokeText(label.text, x, y);
        context.fillText(label.text, x, y);
    }
}
