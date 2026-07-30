import L from 'leaflet';
import { requireElement } from './core/Dom';
import { DeviceOrientationTracker } from './geolocation/DeviceOrientationTracker';
import { GeolocationTracker } from './geolocation/GeolocationTracker';
import { DistanceCircleOverlay, type DistanceCircleStep } from './map/DistanceCircleOverlay';
import { ROAD_LAYER } from './map/MapLayerCatalog';
import { MarkerController } from './markers/MarkerController';
import { QrCodeExport } from './markers/QrCodeExport';
import { AddressSearch } from './search/AddressSearch';
import { SunPath } from './sun/SunPath';
import { TimeSelection } from './sun/TimeSelection';
import { WorldTime } from './sun/WorldTime';
import { GridSelector } from './ui/GridSelector';
import { MapLayerSelector } from './ui/MapLayerSelector';
import { OptionsMenu } from './ui/OptionsMenu';

/** Initial view of the map: centre of Austria. */
const INITIAL_VIEW = { center: [47.5, 13.5] as [number, number], zoom: 8 };

/** Zoom level the map jumps to when the gps position is switched on. */
const LOCATION_ZOOM = 14;

/**
 * View the map jumps to when the world time is switched on. Its overlays cover the
 * whole globe, so the view shows as much of the earth as possible.
 */
const WORLD_TIME_VIEW = { center: [23.5, 16] as [number, number], zoom: 3 };

/** Base map switched to together with WORLD_TIME_VIEW. */
const WORLD_TIME_LAYER = ROAD_LAYER;

/** Spacing of the distance circles per zoom level, from fine to coarse. */
const CIRCLE_STEPS: readonly DistanceCircleStep[] = [
    { step: 100, minZoom: 16 },
    { step: 500, minZoom: 14 },
    { step: 1_000, minZoom: 13 },
    { step: 5_000, minZoom: 10 },
    { step: 10_000, minZoom: 9 },
    { step: 50_000, minZoom: 7 },
    { step: 100_000, minZoom: 6 },
    { step: 500_000, minZoom: 3 },
    { step: 1_000_000, minZoom: 0 }
];

/**
 * Composition root of the application. It creates the map, all features and the
 * connections between them; every piece of logic itself lives in its own class.
 */
export class App {
    readonly #map: L.Map;
    readonly #mapLayers: MapLayerSelector;
    readonly #circles: DistanceCircleOverlay;
    readonly #markers: MarkerController;
    readonly #time: TimeSelection;
    readonly #sunPath: SunPath;
    readonly #worldTime: WorldTime;
    readonly #geolocation: GeolocationTracker;
    /** True while the user pans or zooms; gps updates are ignored then. */
    #userIsMoving = false;

    constructor() {
        this.#map = new L.Map('map', { zoomControl: false })
            .setView(INITIAL_VIEW.center, INITIAL_VIEW.zoom);
        L.control.zoom({ position: 'topright' }).addTo(this.#map);
        this.trackUserInteraction();

        this.#mapLayers = new MapLayerSelector(requireElement('mapTypeList'), this.#map);
        new GridSelector(requireElement('stepList'), this.#map);

        this.#circles = new DistanceCircleOverlay(this.#map, { steps: CIRCLE_STEPS, labels: true });
        this.#markers = this.createMarkers();
        this.#time = new TimeSelection({
            timeline: requireElement('sunTimeline'),
            dateControl: requireElement('sunPathControl')
        });
        this.#sunPath = this.createSunPath();
        this.#worldTime = this.createWorldTime();
        this.connectTimeSelection();
        this.#geolocation = this.createGeolocation();

        this.createSearch();
        this.createOptionsMenu();
    }

    /** Creates the marker feature and connects it to the map and the circles. */
    private createMarkers(): MarkerController {
        const markers = new MarkerController(this.#map, {
            table: requireElement('markerTable'),
            clearButton: requireElement('clearAllMarkers', HTMLButtonElement)
        });

        // Markers passed in the url replace the stored ones; the query is dropped
        // afterwards so a reload does not restore the shared set again.
        if (markers.loadFromQueryString()) {
            window.history.replaceState(null, '',
                `${location.protocol}//${location.host}${location.pathname}`);
        }

        const qrCode = new QrCodeExport(requireElement('markerList'), () => markers.encodeForUrl());
        requireElement('generateQrCode').addEventListener('click', () => qrCode.toggle());

        markers.on('markerselected', (marker) => this.#map.setView([marker.lat, marker.lng]));
        markers.on('homechanged', (marker) => {
            if (marker) this.#circles.setCenter([marker.lat, marker.lng], marker.color);
            else this.#circles.clear();
            this.#sunPath.setHome(marker ? [marker.lat, marker.lng] : null);
        });
        markers.on('clearall', () => {
            this.#geolocation.stop();
            qrCode.hide();
        });

        // A double click drops the gps arrow onto the clicked position, which makes
        // the feature usable without a real gps signal.
        this.#map.on('dblclick', (event) => markers.setLocation([event.latlng.lat, event.latlng.lng]));
        return markers;
    }

    /** Creates the sun path feature. */
    private createSunPath(): SunPath {
        const sunPath = new SunPath(this.#map, {
            dataPanel: requireElement('sunDataPanel'),
            toggleButton: requireElement('toggleSunPath', HTMLButtonElement)
        });
        // The distance circles around the home marker would cover the bearing circle.
        sunPath.on('activechanged', (active) => this.#circles.setEnabled(!active));
        // Only the sun path knows the home position, so only it can supply the
        // brightness of the timeline - also while the feature itself is off.
        sunPath.on('daychanged', (day) => this.#time.setDay(day));
        return sunPath;
    }

    /** Creates the world time feature: earth shadow and true local time grid. */
    private createWorldTime(): WorldTime {
        const worldTime = new WorldTime(this.#map, requireElement('toggleWorldTime', HTMLButtonElement));
        // The shadow and the time grid span the whole globe; a detailed view would
        // show only a fragment of them.
        worldTime.on('activechanged', (active) => {
            if (!active) return;
            this.#mapLayers.select(WORLD_TIME_LAYER);
            this.#map.setView(WORLD_TIME_VIEW.center, WORLD_TIME_VIEW.zoom);
        });
        return worldTime;
    }

    /**
     * Connects the shared moment selection to both time dependent features. Its
     * controls are visible as soon as one of the two features is switched on.
     */
    private connectTimeSelection(): void {
        this.#time.on('daychanged', (date) => this.#sunPath.setDate(date));
        this.#time.on('momentchanged', (moment) => {
            this.#sunPath.setMoment(moment);
            this.#worldTime.setTime(moment);
        });
        // The timeline takes space away from the map.
        this.#time.on('visibilitychanged', () => this.#map.invalidateSize());

        const updateControls = (): void =>
            this.#time.setVisible(this.#sunPath.isActive() || this.#worldTime.isActive());
        this.#sunPath.on('activechanged', updateControls);
        this.#worldTime.on('activechanged', updateControls);

        // Both features were created without a moment; hand them the current one.
        this.#time.refresh();
    }

    /** Creates the gps tracking and its toggle button. */
    private createGeolocation(): GeolocationTracker {
        const button = requireElement('toggleGeolocation', HTMLButtonElement);
        const tracker = new GeolocationTracker(() => this.#userIsMoving);

        tracker.on('positionchanged', (latlng, first) => {
            this.#markers.setLocation(latlng);
            // Move to the position once, right after switching the tracking on.
            if (first) this.#map.setView([latlng[0], latlng[1]], LOCATION_ZOOM);
        });
        tracker.on('stopped', () => {
            button.classList.remove('active');
            this.#markers.setLocation(null);
        });
        tracker.on('failed', (message) => console.warn('Geolocation error:', message));

        button.addEventListener('click', () => button.classList.toggle('active', tracker.toggle()));

        const orientation = new DeviceOrientationTracker();
        orientation.on('headingchanged', (heading) => this.#markers.setLocationHeading(heading));
        return tracker;
    }

    /** Creates the address search. */
    private createSearch(): void {
        const search = new AddressSearch(requireElement('searchForm', HTMLFormElement));
        search.on('found', (latlng) => {
            this.#map.setView([latlng[0], latlng[1]]);
            this.#markers.addMarker(latlng);
        });
    }

    /** Creates the show/hide toggle of the side menu. */
    private createOptionsMenu(): void {
        const menu = new OptionsMenu(
            requireElement('options'), requireElement('toggleOptionsMenu', HTMLButtonElement));
        menu.on('toggled', () => {
            this.#map.invalidateSize();
            this.#markers.centerHomeIfInView();
        });
    }

    /** Remembers whether the user is currently panning or zooming the map. */
    private trackUserInteraction(): void {
        this.#map.on('zoomstart movestart', () => { this.#userIsMoving = true; });
        this.#map.on('zoomend moveend', () => { this.#userIsMoving = false; });
    }
}
