// <script src="https://unpkg.com/suncalc@1.9.0/suncalc.js"></script>

function SunPosition(map) {
    const sunPosition = this;
    sunPosition.latlng = null;
    sunPosition.map = map;

    const sunDiv = L.DomUtil.create('div', 'virtual-sun');
    sunDiv.style.position = 'absolute';
    sunDiv.style.width = '20px';
    sunDiv.style.height = '20px';
    sunDiv.style.borderRadius = '50%';
    sunDiv.style.backgroundColor = 'orange';
    sunDiv.style.pointerEvents = 'none'; // Nicht anklickbar
    sunDiv.style.zIndex = 1000;

    sunPosition.sunDiv = sunDiv;
    sunPosition.lastCalc = 0;
    sunPosition.sunPos = null;

    map.on('rotate', () => {
        sunPosition.drawVirtualSun(new Date());
    });

    const mapContainer = map.getContainer();
    const resizeObserver = new ResizeObserver(() => {
        sunPosition.drawVirtualSun(new Date());
    });
    resizeObserver.observe(mapContainer);
}

SunPosition.prototype.setHome = function (latlng) {
    if (!latlng && this.latlng)
        this.map.getContainer().removeChild(this.sunDiv);
    if (latlng && !this.latlng)
        this.map.getContainer().appendChild(this.sunDiv);


    this.latlng = latlng;
    sunPosition.lastCalc = 0;
    sunPosition.sunPos = null;
    this.drawVirtualSun(new Date());
}

// Gibt den Punkt zurück, wo die Sonne auf einer Map zu zeichnen wäre.
SunPosition.prototype.drawVirtualSun = function (datetime) {
    if (!this.latlng) return;

    const now = Date.now();
    if (now - this.lastCalc > 60_000) {
        this.sunPos = SunCalc.getPosition(datetime, this.latlng[0], this.latlng[1]);
        this.lastCalc = now;
    }
    const map = this.map;
    const size = map.getSize();
    const center = size.divideBy(2);
    // Das Sonnensymbol hat eine Größe von 20px im Durchmesser. Es soll am Bildschirmrand sichtbar sein.
    size.x -= 20;
    size.y -= 20;
    const azimuth = (this.sunPos.azimuth + (map.getBearing() * Math.PI / 180) + Math.PI) % (2 * Math.PI);
    const dx = Math.sin(azimuth);
    const dy = -Math.cos(azimuth);

    // Schnitt mit dem Kartenrand berechnen.
    let tX = Infinity;
    if (dx !== 0) {
        if (dx > 0) {
            tX = (size.x - center.x) / dx;
        } else {
            tX = -center.x / dx;
        }
    }

    let tY = Infinity;
    if (dy !== 0) {
        if (dy > 0) {
            tY = (size.y - center.y) / dy;
        } else {
            tY = -center.y / dy;
        }
    }

    const t = Math.min(tX, tY); // kleinster positiver t-Schnittwert
    const sunPx = L.point(
        center.x + dx * t,
        center.y + dy * t
    );
    this.sunDiv.style.backgroundColor = this.sunPos.altitude < 0 ? "gray" : "orange";
    L.DomUtil.setPosition(this.sunDiv, sunPx);
};
