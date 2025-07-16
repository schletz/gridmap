function Markers(markersDivId) {
    const markers = this;
    markers.markersDiv = document.getElementById(markersDivId);
    markers.storedMarkers = JSON.parse(localStorage.getItem('customMarkers')) || [];
    markers.markerColors = ['red', 'green', 'blue', '#b36b00', 'purple', 'brown', '#000099', 'black'];
    markers.eventHandler = {};
    markers.locationMarker = null;
    markers.homeMarker = null;

    const deviceOrientationEvent = 'ondeviceorientationabsolute' in window
        ? 'deviceorientationabsolute'
        : ('ondeviceorientation' in window ? 'deviceorientation' : "")

    if (deviceOrientationEvent) {
        addEventListener(deviceOrientationEvent, markers.setLocationAngle.bind(markers));
    }

    markers.markersTableDiv = document.createElement('div');
    markers.markersDiv.appendChild(markers.markersTableDiv);

    const controlButtons = document.createElement('div');
    controlButtons.classList.add('controlButtons');

    const deleteAll = document.createElement('button');
    deleteAll.setAttribute("type", "button");
    deleteAll.setAttribute("id", "clearAllMarkers");
    deleteAll.textContent = 'Alle löschen';
    deleteAll.onclick = function () {
        markers.clearMarkers();
        const handler = markers.eventHandler['clearall'];
        if (handler) handler();
    };
    controlButtons.appendChild(deleteAll);

    const qrButton = document.createElement('button');
    qrButton.setAttribute("type", "button");
    qrButton.setAttribute("id", "generateQrCode");
    qrButton.textContent = 'QR erstellen';
    qrButton.onclick = function () {
        let qrCanvas = document.getElementById("qrCanvas");
        if (qrCanvas) {
            qrCanvas.remove();
            return;
        }
        const url = location.protocol + '//' + location.host + location.pathname;
        const qrData = `${url}?setMarkers=${markers.generateQrData()}`;
        qrCanvas = document.createElement("canvas");
        qrCanvas.setAttribute("id", "qrCanvas");
        qrCanvas.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(qrData);
                alert("Link kopiert.");
            } catch (err) {
                alert('Kopieren fehlgeschlagen: ' + err);
            }
        });

        const qr = new QRious({
            element: qrCanvas,
            size: 250,
            value: qrData
        });
        markers.markersDiv.appendChild(qrCanvas);
    };
    controlButtons.appendChild(qrButton);
    markers.markersDiv.appendChild(controlButtons);
}


Markers.prototype.setMap = function (map) {
    const markers = this;
    markers.map = map;
    markers.markersGroup = L.layerGroup().addTo(map);

    markers.updateMarkersTable();
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

Markers.prototype.on = function (event, callback) {
    this.eventHandler[event] = callback;
}

Markers.prototype.addMarker = function (latlng) {
    let id = 1;
    for (const marker of this.storedMarkers) {
        if (marker.id != id) break;
        id++;
    }
    const color = this.markerColors[(id - 1) % this.markerColors.length];
    this.storedMarkers.push({ lat: latlng.lat, lng: latlng.lng, id: id, color: color });
    this.storedMarkers.sort((a, b) => a.id - b.id);
    localStorage.setItem('customMarkers', JSON.stringify(this.storedMarkers));
    this.updateMarkersTable();
    this.updateMarkersLayer();
}

Markers.prototype.removeMarker = function (id) {
    this.storedMarkers = this.storedMarkers.filter(m => m.id != id);
    localStorage.setItem('customMarkers', JSON.stringify(this.storedMarkers));
    if (this.homeMarker?.id === id)
        this.setHomeMarker(null, false);
    this.updateMarkersTable();
    this.updateMarkersLayer();
}

Markers.prototype.setLocation = function (latlng) {
    this.locationMarker = latlng ? { lat: latlng[0], lng: latlng[1], id: 0, color: '#007bff', angle: 0 } : null;
    // Wenn der aktuelle Standort auch home ist, müssen wir die Koordinaten des Home Standortes
    // auch anpassen.
    if (this.homeMarker?.id === 0) {
        this.setHomeMarker(this.locationMarker, false);
    }
    this.updateMarkersLayer();
    this.updateMarkersTable();
}

Markers.prototype.setLocationAngle = function (e) {
    if (!this.locationMarker) return;
    const angle = e.webkitCompassHeading || e.alpha;
    let deviceOrientation = 0;

    // Safari iOS
    if (!e.absolute && e.webkitCompassHeading) {
        angle = 360 - angle;
    }

    // Older browsers
    if (!e.absolute && 'undefined' !== typeof window.orientation) {
        deviceOrientation = window.orientation;
    }
    this.locationMarker.angle = 360 - (angle - deviceOrientation);
    this.updateLocationMarker();
}

Markers.prototype.setHomeMarker = function (marker, updateState = true) {
    this.homeMarker = marker;
    if (marker)
        this.map.setCircleCenter([marker.lat, marker.lng], marker.color);
    else
        this.map.clearDistanceCircles();
    if (updateState) {
        this.updateMarkersLayer();
        this.updateMarkersTable();
    }
}

// Lädt Marker vom Querystring
// http://127.0.0.1:5500/?setMarkers=1_red_47820532_10892944$2_green_47720849_11771851$3_blue_47219568_10898438
Markers.prototype.loadMarkersFromAddress = function () {
    const searchParams = new URLSearchParams(window.location.search);
    if (!searchParams.has('setMarkers')) return false;
    const data = searchParams.get('setMarkers').replace("%23", "#");
    const markers = data.split("$").map(m => {
        const parts = m.split("_");
        return {
            id: parts[0], color: parts[1],
            lat: parts[2] / 1_000_000,
            lng: parts[3] / 1_000_000
        };
    })
    markers.sort((a, b) => a.id - b.id);
    this.storedMarkers = markers;
    localStorage.setItem('customMarkers', JSON.stringify(markers));
    return true;
}

Markers.prototype.generateQrData = function () {
    const markerStrings = this.storedMarkers.map(m =>
        `${m.id}_${m.color}_${Math.round(1_000_000 * m.lat)}_${Math.round(1_000_000 * m.lng)}`
            .replace("#", "%23")  // HTML Farbwerte
    );
    return markerStrings.join("$");
}

Markers.prototype.centerHomeIfInView = function () {
    if (!this.homeMarker) return;
    const bounds = map.getBounds();
    if (bounds.contains(this.homeMarker))
        this.map.setView(this.homeMarker);
}

Markers.prototype.clearMarkers = function () {
    this.setHomeMarker(null, false);
    this.storedMarkers = [];
    localStorage.removeItem('customMarkers');
    this.updateMarkersTable();
    this.updateMarkersLayer();
}

Markers.prototype.updateLocationMarker = function() {
    const markers = this;
    if (!markers.locationMarker) return;
    if (markers.locationMarkerMap) markers.locationMarkerMap.remove();

    const locationMarkerMap = L.marker([markers.locationMarker.lat, markers.locationMarker.lng], {
        icon: L.divIcon({
            className: '',
            html: `
          <div class="custom-marker" style="transform: rotate(${markers.locationMarker.angle}deg);">
            <svg viewBox="0 0 100 100">
              <path d="M10,90 L50,10 L90,90 L50,70 Z" fill="white"/>
            </svg>
          </div>
        `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
        })
    });
    locationMarkerMap.addTo(this.markersGroup);
    markers.locationMarkerMap = locationMarkerMap;
}

Markers.prototype.updateMarkersLayer = function () {
    const markers = this;
    markers.markersGroup.clearLayers();

    markers.updateLocationMarker();
    markers.storedMarkers.forEach(marker => {
        L.marker([marker.lat, marker.lng], {
            icon: L.divIcon({
                className: 'custom-marker-icon',
                html: `<div class="marker-number" style="background:${marker.color}">${marker.id}</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            })
        }).addTo(this.markersGroup);
    });
    const homeMarker = markers.homeMarker;
    if (homeMarker) {
        const markersArray = markers.locationMarker ? [markers.locationMarker, ...markers.storedMarkers] : markers.storedMarkers;
        markersArray.forEach(marker => {
            if (marker == homeMarker) return;
            const line = L.polyline([homeMarker, [marker.lat, marker.lng]], {
                color: marker.color,
                weight: 2,
                opacity: 0.8
            });
            line.addTo(markers.markersGroup);
        });
    }
}

Markers.prototype.updateMarkersTable = function () {
    const markers = this;
    const map = markers.map;
    const markersTableDiv = markers.markersTableDiv;

    markersTableDiv.innerHTML = '';
    const table = document.createElement('table');
    markersTableDiv.appendChild(table);

    const header = document.createElement('tr');
    header.innerHTML = "<th style='width:10%'>#</th><th style='width:33%'>Lat</th><th style='width:33%'>Lng</th><th style='width:34%'>Entf</th>";
    table.appendChild(header);

    // Marker 0 (GPS Position)
    if (markers.locationMarker) {
        const locationMarker = markers.locationMarker;
        const lat = locationMarker.lat.toFixed(6);
        const lng = locationMarker.lng.toFixed(6);
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.innerHTML = `
                    <td rowspan="2" style="color:${markers.locationMarker.color}">#0</td>
                    <td class="position">${lat}</td>
                    <td class="position">${lng}</td>
                    <td class="position">-</td>
                `;
        row.addEventListener('click', () => {
            const handler = markers.eventHandler['markerselected'];
            if (handler) handler(markers.locationMarker);
        });

        const buttonRow = document.createElement('tr');
        buttonRow.classList.add("buttonRow");
        buttonRow.innerHTML = `
            <td colspan="3">
            <button class="addButton" style="font-size: small;">ADD</button>
            <button class="homeButton" style="font-size: small;">H</button>
            </td>
        `
        buttonRow.querySelector('.addButton').addEventListener('click', () => {
            markers.addMarker(locationMarker);
        });
        buttonRow.querySelector('.homeButton').addEventListener('click', () => {
            const handler = markers.eventHandler['homeselected'];
            markers.setHomeMarker(markers.locationMarker);
            if (handler) handler(markers.locationMarker);
        });
        if (this.homeMarker?.id === 0) {
            row.classList.add("homeRow")
            buttonRow.classList.add("homeRow")
        }
        table.appendChild(row);
        table.appendChild(buttonRow);
    }
    // Gespeicherte Marker
    markers.storedMarkers.forEach(marker => {
        if (!marker.lat || !marker.lng || !marker.id) return;
        const lat = marker.lat.toFixed(6);
        const lng = marker.lng.toFixed(6);
        const distance = markers.homeMarker ? map.distance(markers.homeMarker, marker) : 0;
        const distanceStr = !markers.homeMarker ? "-" : distance >= 1000
            ? `${(distance / 1000).toFixed(2)} km`
            : `${Math.round(distance)} m`;

        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.innerHTML = `
                    <td rowspan="2" style="color:${marker.color}">#${marker.id}</td>
                    <td class="position">${lat}</td>
                    <td class="position">${lng}</td>
                    <td class="position">${distanceStr}</td>
                `;

        row.addEventListener('click', () => {
            const handler = markers.eventHandler['markerselected'];
            if (handler) handler(marker);
        });

        const buttonRow = document.createElement('tr');
        buttonRow.classList.add("buttonRow");
        buttonRow.innerHTML = `
            <td colspan="3">
            <button class="deleteButton" style="font-size: small;">DEL</button>
            <button class="homeButton" style="font-size: small;">H</button>            
            </td>
        `
        buttonRow.querySelector('.deleteButton').addEventListener('click', () => {
            markers.removeMarker(marker.id);
        });

        buttonRow.querySelector('.homeButton').addEventListener('click', () => {
            const handler = markers.eventHandler['homeselected'];
            markers.setHomeMarker(marker);
            if (handler) handler(marker);
        });
        if (marker == this.homeMarker) {
            row.classList.add("homeRow")
            buttonRow.classList.add("homeRow")
        }
        table.appendChild(row);
        table.appendChild(buttonRow);
    });

    markersTableDiv.appendChild(table);
}
