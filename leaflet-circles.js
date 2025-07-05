const _createDistanceLabel = function (latlng, radius, fontSize = 12, marginTop = 0, marginLeft = 0) {
    const radiusStr = radius >= 1000 ? `${radius / 1000}km` : `${radius}m`
    return L.marker(latlng, {
        icon: L.divIcon({
            className: 'distance-label',
            html: `<div style="margin-top:${marginTop}px; margin-left:${marginLeft}px; font-size:${fontSize}px; color:#00254d; font-weight:bolder;">
                    ${radiusStr}
                </div>`,
            iconSize: [30, 12],
            iconAnchor: [15, 6]
        })
    });
}

const _drawDistanceLabels = function () {
    if (!this.circleCenter) return;

    const latlng = this.circleCenter;
    const labelLayerGroup = this.labelLayerGroup;
    labelLayerGroup.clearLayers();
    const bounds = this.getBounds();
    const zoom = this.getZoom();

    const viewTop = bounds.getNorth();
    const viewBottom = bounds.getSouth();

    const φ1 = latlng[0] * Math.PI / 180;
    const λ1 = latlng[1] * Math.PI / 180;
    const earthRadius = 6371000;

    this.circles.forEach(circle => {
        if (zoom >= circle.minZoom) {
            const δ = circle.radius / earthRadius;

            const circleTopLat = (φ1 + δ) * 180 / Math.PI;
            const circleBottomLat = (φ1 - δ) * 180 / Math.PI;
            if (circleTopLat <= viewTop && circleTopLat >= viewBottom ||
                circleBottomLat <= viewTop && circleBottomLat >= viewBottom) {
                _createDistanceLabel(L.latLng(circleTopLat, latlng[1]), circle.radius, 12, 0, 0).addTo(labelLayerGroup);
                _createDistanceLabel(L.latLng(circleBottomLat, latlng[1]), circle.radius, 12, 0, 0).addTo(labelLayerGroup);
                return;
            }

            const φ_view = viewTop * Math.PI / 180;
            const cosArgTop = (Math.cos(δ) - Math.sin(φ1) * Math.sin(φ_view)) / (Math.cos(φ1) * Math.cos(φ_view));
            if (Math.abs(cosArgTop) <= 1) {
                const angle = Math.acos(cosArgTop);
                const λ_right = λ1 + angle;
                const λ_left = λ1 - angle;

                const lngRight = λ_right * 180 / Math.PI;
                const lngLeft = λ_left * 180 / Math.PI;

                _createDistanceLabel(L.latLng(viewTop, lngRight), circle.radius, 16, 10, 0).addTo(labelLayerGroup);
                _createDistanceLabel(L.latLng(viewTop, lngLeft), circle.radius, 16, 10, 0).addTo(labelLayerGroup);
            }
        }
    });
}

L.Map.prototype.setDistanceCircles = function (circles, drawLabels) {
    const map = this;
    map.distanceCircleGroup = L.layerGroup().addTo(this);
    map.labelLayerGroup = L.layerGroup().addTo(this);
    map.circles = circles;
    map.circleCenter = null;
    map.drawDistanceLabels = drawLabels ? _drawDistanceLabels : () => { };

    map.on('zoomend', () => {
        map.drawDistanceCircles();
    });
    map.on('moveend', () => {
        map.drawDistanceLabels();
    });
}

L.Map.prototype.setCircleCenter = function(latlng) {
    this.circleCenter = latlng;
    this.drawDistanceCircles();
}

L.Map.prototype.clearDistanceCircles = function () {
    this.distanceCircleGroup.clearLayers();
    this.labelLayerGroup.clearLayers();
    this.circleCenter = null;
}

L.Map.prototype.drawDistanceCircles = function () {
    if (!this.circleCenter) return;

    const latlng = this.circleCenter;
    distanceCircleGroup = this.distanceCircleGroup;
    distanceCircleGroup.clearLayers();
    const zoom = this.getZoom();

    this.circles.forEach(c => {
        if (zoom >= c.minZoom) {
            const circle = L.circle(latlng, {
                radius: c.radius,
                color: "#007bff",
                weight: 1,
                fillOpacity: 0
            });
            circle.addTo(distanceCircleGroup);
        }
    });
    this.drawDistanceLabels();
}


