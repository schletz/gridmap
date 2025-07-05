const _formatDistance = function (homeMarker, marker) {
    if (!homeMarker) return "-";
    if (!marker) return "-";

    const R = 6371000; // Erdradius in Metern
    const φ1 = homeMarker.lat * Math.PI / 180;
    const φ2 = marker.lat * Math.PI / 180;
    const Δφ = (marker.lat - homeMarker.lat) * Math.PI / 180;
    const Δλ = (marker.lng - homeMarker.lng) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) ** 2 +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const d = R * c;
    return d >= 1000 ? `${(d / 1000).toFixed(2)} km` : `${Math.round(d)} m`;
}

function Markers(markersDivId) {
    const markers = this;
    markers.markersDiv = document.getElementById(markersDivId);
    markers.storedMarkers = JSON.parse(localStorage.getItem('customMarkers')) || [];
    markers.markerColors = ['red', 'green', 'blue', 'orange', 'purple', 'brown', 'black'];

    markers.updateMarkersTable();
}

Markers.prototype.setMap = function(map) {
    const markers = this;
    markers.map = map;
    markers.markersGroup = L.layerGroup().addTo(map);
    markers.homeMarker = null;

    markers.updateMarkersLayer();

    // Rechtsklick (Desktop)
    map.on('contextmenu', (e) => {
        markers.addMarker(e.latlng);
    });

    // Langes Tippen (Mobil)
    let touchTimer = null;
    map.on('touchstart', (e) => {
        if (e.originalEvent.touches.length !== 1) return;
        touchTimer = setTimeout(() => {
            const touch = e.originalEvent.touches[0];
            const latlng = map.containerPointToLatLng([touch.clientX, touch.clientY]);
            markers.addMarker(latlng);
        }, 600);
    });

    map.on('touchend', () => {
        if (touchTimer) clearTimeout(touchTimer);
    });
}

Markers.prototype.addMarker = function (latlng) {
    let id = 1;
    for (const marker of this.storedMarkers) {
        if (marker.id != id) break;
        id++;
    }
    const color = this.markerColors[(id - 1) % this.markerColors.length];
    this.storedMarkers.push({ lat: latlng.lat, lng: latlng.lng, id: id, color: color });
    localStorage.setItem('customMarkers', JSON.stringify(this.storedMarkers));
    this.updateMarkersTable();
    this.updateMarkersLayer();
}

Markers.prototype.removeMarker = function (id) {
    this.storedMarkers = this.storedMarkers.filter(m => m.id != id);
    localStorage.setItem('customMarkers', JSON.stringify(this.storedMarkers));
    this.updateMarkersTable();
    this.updateMarkersLayer();
}

Markers.prototype.setHome = function (latlng) {
    this.homeMarker = latlng ? { lat: latlng[0], lng: latlng[1], id: 0, color: '#007bff' } : null;
    this.updateMarkersTable();
    this.updateMarkersLayer();
}

Markers.prototype.clearMarkers = function () {
    this.storedMarkers = [];
    localStorage.removeItem('customMarkers');
    this.updateMarkersTable();
    this.updateMarkersLayer();
}

Markers.prototype.updateMarkersLayer = function () {
    const markers = this;
    this.markersGroup.clearLayers();

    this.storedMarkers.forEach(marker => {
        L.marker([marker.lat, marker.lng], {
            icon: L.divIcon({
                className: 'custom-marker-icon',
                html: `<div class="marker-number" style="background:${marker.color}">${marker.id}</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            })
        }).addTo(this.markersGroup);
    });
    if (!markers.homeMarker) return;

    const latlng = [markers.homeMarker.lat, markers.homeMarker.lng];
    L.marker([markers.homeMarker.lat, markers.homeMarker.lng], {
        icon: L.divIcon({
            className: 'custom-marker-icon',
            html: `<div class="marker-number" style="background:${markers.homeMarker.color}">${markers.homeMarker.id}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        })
    }).addTo(this.markersGroup);
    this.storedMarkers.forEach(marker => {
        const line = L.polyline([latlng, [marker.lat, marker.lng]], {
            color: marker.color,
            weight: 2,
            opacity: 0.8
        });
        line.addTo(markers.markersGroup);
    });
}

Markers.prototype.updateMarkersTable = function () {
    const markers = this;
    const map = markers.map;
    const markersDiv = markers.markersDiv;

    markersDiv.innerHTML = '';
    const table = document.createElement('table');
    markersDiv.appendChild(table);

    const header = document.createElement('tr');
    header.innerHTML = "<th>#</th><th>Lat</th><th>Lng</th><th>Entf</th><th></th>";
    table.appendChild(header);

    // Marker 0 (aktuelle Position)
    if (markers.homeMarker) {
        const homeMarker = markers.homeMarker;
        const lat = homeMarker.lat.toFixed(6);
        const lng = homeMarker.lng.toFixed(6);
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.innerHTML = `
                    <td style="color:${markers.homeMarker.color}">#0</td>
                    <td>${lat}</td>
                    <td>${lng}</td>
                    <td>-</td>
                    <td></td>
                `;
        row.querySelector('td:nth-child(2)').addEventListener('click', () => {
            map.setView([markers.homeMarker.lat, markers.homeMarker.lng], 15);
        });
        table.appendChild(row);
    }

    // Gespeicherte Marker
    markers.storedMarkers.forEach(marker => {
        if (!marker.lat || !marker.lng || !marker.id) return;
        const lat = marker.lat.toFixed(6);
        const lng = marker.lng.toFixed(6);
        const distance = _formatDistance(markers.homeMarker, marker);

        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.innerHTML = `
                    <td style="color:${marker.color}">#${marker.id}</td>
                    <td>${lat}</td>
                    <td>${lng}</td>
                    <td>${distance}</td>
                    <td><button style="font-size: small;">🗑</button></td>
                `;

        row.querySelector('td:nth-child(2)').addEventListener('click', () => {
            map.setView([marker.lat, marker.lng], 15);
        });

        row.querySelector('button').addEventListener('click', () => {
            markers.removeMarker(marker.id);
        });

        table.appendChild(row);
    });

    markersDiv.appendChild(table);
    const deleteAll = document.createElement('button');
    deleteAll.textContent = 'Alle Marker löschen';
    deleteAll.setAttribute("id", "clearAllMarkers");
    deleteAll.onclick = function () {
        markers.clearMarkers();
    };
    markersDiv.appendChild(deleteAll);
}
