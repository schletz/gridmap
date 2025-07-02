const _calcCircleBoundingBox = function (latlng, radiusMeters) {
    const earthRadius = 6371000; // mittlerer Erdradius in Metern
    const deltaLat = (radiusMeters / earthRadius) * (180 / Math.PI);
    const deltaLon = (radiusMeters / (earthRadius * Math.cos(latlng[0] * Math.PI / 180))) * (180 / Math.PI);

    return {
        north: latlng[0] + deltaLat,
        south: latlng[0] - deltaLat,
        west: latlng[1] - deltaLon,
        east: latlng[1] + deltaLon
    }
}

const _calcNearestEdge = function (circleCenter, north, west, south, east) {
    if (circleCenter[0] >= north && circleCenter[1] <= west) return [north, west];
    if (circleCenter[0] >= north && circleCenter[1] >= east) return [north, east];
    if (circleCenter[0] <= south && circleCenter[1] <= west) return [south, west];
    if (circleCenter[0] <= south && circleCenter[1] >= east) return [south, east];
    if (circleCenter[0] >= north) return [north, circleCenter[1]];
    if (circleCenter[0] <= south) return [south, circleCenter[1]];
    if (circleCenter[1] <= west) return [circleCenter[0], west];
    if (circleCenter[1] >= east) return [circleCenter[0], east];
    return [(north + south) / 2, (east + west) / 2];
}

const _createDistanceLabel = function (latlng, radius, fontSize = 12, marginTop = 0, marginLeft = 0) {
    const radiusStr = radius >= 1000 ? `${radius / 1000}km` : `${radius}m`
    return L.marker(latlng, {
        icon: L.divIcon({
            className: 'distance-label',
            html: `<div style="margin-top:${marginTop}px; margin-left:${marginLeft}px; font-size:${fontSize}px;">
                    ${radiusStr}
                </div>`,
            iconSize: [30, 12],
            iconAnchor: [15, 6]
        })
    });
}

const _drawDistanceLabels = function () {
    if (!this.circleCenter) return;

    const map = this;
    const latlng = map.circleCenter;
    const labelLayerGroup = map.labelLayerGroup;
    labelLayerGroup.clearLayers();
    const bounds = map.getBounds();

    const north = bounds.getNorth();
    const south = bounds.getSouth();
    const west = bounds.getWest();
    const east = bounds.getEast();

    const φ1 = latlng[0] * Math.PI / 180;
    const λ1 = latlng[1] * Math.PI / 180;

    map.visibleDistanceCircles.forEach(circle => {
        const circleBoundingBox = _calcCircleBoundingBox(latlng, circle.radius);
        if (circleBoundingBox.north <= north && circleBoundingBox.north >= south && latlng[1] >= west && latlng[1] <= east) {
            _createDistanceLabel([circleBoundingBox.north, latlng[1]], circle.radius, 12, 0, 0).addTo(labelLayerGroup);
        }
        if (circleBoundingBox.south <= north && circleBoundingBox.south >= south && latlng[1] >= west && latlng[1] <= east) {
            _createDistanceLabel([circleBoundingBox.south, latlng[1]], circle.radius, 12, 0, 0).addTo(labelLayerGroup);
        }

        const δ = circle.radius / 6371000;
        const φ_view = north * Math.PI / 180;
        const cosArgTop = (Math.cos(δ) - Math.sin(φ1) * Math.sin(φ_view)) / (Math.cos(φ1) * Math.cos(φ_view));
        if (Math.abs(cosArgTop) <= 1) {
            const angle = Math.acos(cosArgTop);
            const λ_right = λ1 + angle;
            const λ_left = λ1 - angle;

            const lngRight = λ_right * 180 / Math.PI;
            const lngLeft = λ_left * 180 / Math.PI;

            _createDistanceLabel([north, lngRight], circle.radius, 12, 10, 0).addTo(labelLayerGroup);
            _createDistanceLabel([north, lngLeft], circle.radius, 12, 10, 0).addTo(labelLayerGroup);
        }
    });
}

L.Map.prototype.setDistanceCircles = function (options) {
    options = options || {};
    const map = this;
    map.distanceCircleGroup = L.layerGroup().addTo(this);
    map.labelLayerGroup = L.layerGroup().addTo(this);
    map.circleCenter = null;
    map.circleColor = null;
    map.drawDistanceLabels = options.labels ? _drawDistanceLabels : () => { };
    map.visibleDistanceCircles = [];
    map.steps = options.steps || [{ step: 1000, minZoom: 12 }]

    map.on('zoomend', () => {
        map.drawDistanceCircles();
    });
    map.on('moveend', () => {
        map.drawDistanceCircles();
    });
}

L.Map.prototype.setCircleCenter = function (latlng, color) {
    this.circleCenter = latlng;
    this.circleColor = color || "#007bff"
    this.drawDistanceCircles();
}

L.Map.prototype.clearDistanceCircles = function () {
    this.distanceCircleGroup.clearLayers();
    this.labelLayerGroup.clearLayers();
    this.circleCenter = null;
}

L.Map.prototype.drawDistanceCircles = function () {
    if (!this.circleCenter) return;

    const map = this;
    const zoom = map.getZoom();
    const step = map.steps.find(s => s.minZoom <= zoom)?.step;
    if (!step) return;

    const circleCenter = map.circleCenter;
    distanceCircleGroup = map.distanceCircleGroup;
    distanceCircleGroup.clearLayers();
    map.visibleDistanceCircles = [];

    // Vorausberechnungen, welche Linien welcher Kreise überhaupt im Kartenfenster angezeigt werden.
    const bounds = map.getBounds();
    const north = bounds.getNorth();
    const south = bounds.getSouth();
    const west = bounds.getWest();
    const east = bounds.getEast();
    const centerIsOnMap = circleCenter[0] <= north && circleCenter[0] >= south
        && circleCenter[1] <= east && circleCenter[1] >= west;
    // Liegt der Mittelpunkt des Kreises auf der Karte, entscheiden die Abstände zu den Ecken, ob eine Kreislinie sichtbar ist.
    // Ist der Abstand immer > r, kann keine Linie sichtbar sein.
    // Liegt der Mittelpunkt des Kreises außerhalb der Karte, werden die nächsten Punkte des Rechtecks zum Mittelpunkt analysiert.
    // Ist ein Punkt < r und ein Punkt > r, deht eine Linie durch.
    const maxDistance = Math.max(
        map.distance(circleCenter, [north, west]),
        map.distance(circleCenter, [north, east]),
        map.distance(circleCenter, [south, east]),
        map.distance(circleCenter, [south, west])
    );
    const minDistance = !centerIsOnMap
        ? map.distance(circleCenter, _calcNearestEdge(circleCenter, north, west, south, east)) : 0;

    const minRadius = centerIsOnMap ? step : Math.floor(minDistance / step) * step;
    for (radius = minRadius; radius <= maxDistance; radius += step) {
        const circle = L.circle(circleCenter, {
            radius: radius,
            color: this.circleColor,
            weight: radius % (5 * step) == 0 ? 2 : 1,
            fillOpacity: 0
        });
        map.visibleDistanceCircles.push({ radius });
        circle.addTo(distanceCircleGroup);
    }
    //console.log(`${map.visibleDistanceCircles.length} circles on map.`)
    map.drawDistanceLabels();
}


