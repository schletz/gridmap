import L from 'leaflet';

/** One selectable base map. */
export interface MapLayerDefinition {
    /** Label shown in the menu. */
    readonly title: string;
    /** Tile url template. */
    readonly url: string;
    /** Tile layer options of this source. */
    readonly options: L.TileLayerOptions;
}

/**
 * Plain road map. It is named because other features switch to it, so they can
 * reference the definition itself instead of its position in MAP_LAYERS.
 */
export const ROAD_LAYER: MapLayerDefinition = {
    title: 'Road',
    url: 'https://tiles.bergfex.at/styles/bergfex-osm/{z}/{x}/{y}.jpg',
    options: { maxZoom: 19, opacity: 0.8 }
};

/**
 * All base maps in the order they appear in the menu. The previous version kept
 * this list split between the markup (labels) and the bootstrap script (urls),
 * which made adding a map a two step change.
 */
export const MAP_LAYERS: readonly MapLayerDefinition[] = [
    {
        title: 'OSM',
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        options: { maxZoom: 19 }
    },
    {
        title: 'Open Topo',
        url: 'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
        options: { maxZoom: 17 }
    },
    ROAD_LAYER,
    {
        title: 'Luftbild',
        url: 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        options: { maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] }
    },
    {
        title: 'Basemap (AT)',
        url: 'https://mapsneu.wien.gv.at/basemap/bmaphidpi/normal/google3857/{z}/{y}/{x}.jpeg',
        options: { minZoom: 8, maxZoom: 19 }
    },
    {
        title: 'Luftbild (AT)',
        url: 'https://mapsneu.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/{z}/{y}/{x}.jpeg',
        options: { minZoom: 8, maxZoom: 19 }
    },
    {
        title: 'OEK (AT)',
        url: 'https://maps.bev.gv.at/tiles/karte/{z}/{x}/{y}.png',
        options: { minZoom: 8, maxZoom: 16 }
    },
    {
        title: 'OEK (1880)',
        url: 'https://maps.bev.gv.at/tiles/EPO1/{z}/{x}/{y}.png',
        options: { minZoom: 9, maxZoom: 16 }
    },
    {
        title: 'OEK (1910)',
        url: 'https://maps.bev.gv.at/tiles/EPO2/{z}/{x}/{y}.png',
        options: { minZoom: 9, maxZoom: 14 }
    },
    {
        title: 'OEK (1960)',
        url: 'https://maps.bev.gv.at/tiles/EPO4/{z}/{x}/{y}.png',
        options: { minZoom: 9, maxZoom: 14 }
    },
    {
        title: 'OEK (1980)',
        url: 'https://maps.bev.gv.at/tiles/EPO5/{z}/{x}/{y}.png',
        options: { minZoom: 9, maxZoom: 14 }
    },
    {
        title: 'ÖPNV',
        url: 'https://tileserver.memomaps.de/tilegen/{z}/{x}/{y}.png',
        options: { maxZoom: 18 }
    }
];
