# Kartenblick – Architektur

## Zweck

Einseitige Kartenanwendung ("Kartenblick") auf Basis von Leaflet, die als **einzelne statische
HTML-Datei** ([index.html](index.html), Build-Ergebnis) für GitHub Pages ausgeliefert wird.

- Auswahl aus zwölf Basemaps (OSM, Luftbilder, historische ÖK-Karten).
- Marker per Rechtsklick/Long-Press, ein Marker ist "Home"; um ihn Entfernungskreise und
  Verbindungslinien zu allen anderen Markern.
- Koordinatengitter mit wählbarer Abstufung von 10° bis 1".
- Adresssuche über Nominatim.
- GPS-Position und Gerätekompass (Pfeilmarker mit Drehung).
- Sonnenverlauf: Peilkreis mit Tagesbogen und Solardaten für den Home-Marker.
- Weltzeit: Erdschatten und ein Gitter der wahren Ortszeit, ohne Bezugspunkt.
- Zeitleiste und Datumsauswahl gehören beiden Features gemeinsam, inklusive eines Live-Modus, der
  sekündlich die Systemzeit übernimmt.
- Export des Markersatzes als QR-Code / Link, Import über den Querystring.

Kein Backend, kein Build-Server: Vite bündelt alles zu einer Datei, ein Git-Hook baut vor jedem
Commit neu.

---

## Modulüberblick

Gesamt 3.630 TS-Zeilen + 394 CSS + 84 HTML.

| Datei | Zeilen | Verantwortung |
| --- | --- | --- |
| [src/main.ts](src/main.ts) | 5 | Einstiegspunkt: CSS importieren, `new App()`. |
| [src/App.ts](src/App.ts) | 196 | Composition Root: erzeugt Karte + alle Features und verdrahtet deren Events. Enthält selbst keine Fachlogik. |
| [src/index.html](src/index.html) | 84 | Statisches DOM-Gerüst. Alle IDs, die `requireElement` erwartet, stehen hier. |
| [src/styles/index.css](src/styles/index.css) | 394 | Layout (Flexbox: Menü links, Kartenbereich rechts), Marker-, Grid-, Sonnenverlauf- und Weltzeit-Styles. |
| [src/core/Dom.ts](src/core/Dom.ts) | 15 | `requireElement` – Typ-geprüfter `getElementById`, wirft bei fehlendem Element. |
| [src/core/Geo.ts](src/core/Geo.ts) | 11 | `LatLngTuple`, `EARTH_RADIUS`, Grad/Bogenmaß. |
| [src/core/TypedEventEmitter.ts](src/core/TypedEventEmitter.ts) | 58 | Typisierte Pub/Sub-Basisklasse; Basis fast aller Feature-Klassen. |
| [src/map/MapLayerCatalog.ts](src/map/MapLayerCatalog.ts) | 79 | Datenliste der Basemaps (Titel, URL-Template, Zoomgrenzen). |
| [src/map/MapCanvasOverlay.ts](src/map/MapCanvasOverlay.ts) | 90 | Abstrakte Canvas-Overlay-Basis am Map-Container (nicht an einer Leaflet-Pane). |
| [src/map/DistanceCircleOverlay.ts](src/map/DistanceCircleOverlay.ts) | 154 | Konzentrische Entfernungskreise als `L.circle`-Gruppe. |
| [src/map/DistanceCircleLabels.ts](src/map/DistanceCircleLabels.ts) | 91 | Radiusbeschriftungen der Kreise. |
| [src/map/grids/MapGrid.ts](src/map/grids/MapGrid.ts) | 108 | Gitter-Basisklasse (LayerGroup + Redraw-Lifecycle). |
| [src/map/grids/DegreeGrid.ts](src/map/grids/DegreeGrid.ts) | 64 | Meridiane/Breitenkreise, Abstand in Bogensekunden. |
| [src/map/grids/MetricGrid.ts](src/map/grids/MetricGrid.ts) | 67 | Metrisches Gitter im Mercator-Plan. **Aktuell nicht über das Menü erreichbar.** |
| [src/markers/MarkerTypes.ts](src/markers/MarkerTypes.ts) | 23 | `MapMarker`, `LocationMarker`, Farbpalette. |
| [src/markers/MarkerStore.ts](src/markers/MarkerStore.ts) | 112 | Alleiniger Besitzer der Markerdaten, persistiert in `localStorage`. |
| [src/markers/MarkerController.ts](src/markers/MarkerController.ts) | 190 | Klammer aus Store, Kartenlayer und Tabelle; hält GPS-Position und Home-Marker. |
| [src/markers/MarkerLayer.ts](src/markers/MarkerLayer.ts) | 99 | Rendert Marker, GPS-Pfeil und Home-Verbindungslinien. |
| [src/markers/MarkerListView.ts](src/markers/MarkerListView.ts) | 135 | Markertabelle im Menü, meldet Absichten als Events. |
| [src/markers/MarkerUrlCodec.ts](src/markers/MarkerUrlCodec.ts) | 55 | Kodierung des Markersatzes für den Querystring. |
| [src/markers/QrCodeExport.ts](src/markers/QrCodeExport.ts) | 63 | QR-Code des Export-Links (QRious). |
| [src/search/AddressSearch.ts](src/search/AddressSearch.ts) | 56 | Nominatim-Geocoding. |
| [src/geolocation/GeolocationTracker.ts](src/geolocation/GeolocationTracker.ts) | 87 | `watchPosition` mit Drosselung. |
| [src/geolocation/DeviceOrientationTracker.ts](src/geolocation/DeviceOrientationTracker.ts) | 44 | Gerätekompass. |
| [src/sun/SolarAstronomy.ts](src/sun/SolarAstronomy.ts) | 415 | Zustandslose Sonnengeometrie über SunCalc. Kernstück beider Sonnen-Features. |
| [src/sun/TimeSelection.ts](src/sun/TimeSelection.ts) | 181 | Gemeinsamer Zeitpunkt (Tag + Tageszeit) von `SunPath` und `WorldTime`; besitzt Zeitleiste, Datumsauswahl und den Live-Timer. Kennt **keinen** Ort. |
| [src/sun/SunPath.ts](src/sun/SunPath.ts) | 159 | Feature-Koordinator "Sonnenverlauf": Peilkreis + Solardaten. Braucht einen Home-Marker. |
| [src/sun/WorldTime.ts](src/sun/WorldTime.ts) | 78 | Feature-Koordinator "Weltzeit": Erdschatten + Ortszeit-Gitter. Braucht **keinen** Bezugspunkt. |
| [src/sun/SolarTimeGrid.ts](src/sun/SolarTimeGrid.ts) | 104 | Gitter der wahren Ortszeit (15°-Meridiane ab dem Sonnenmeridian). Canvas-Overlay, **kein** `MapGrid`. |
| [src/sun/SunCompass.ts](src/sun/SunCompass.ts) | 272 | Peilkreis mit Tagesbogen und Jahresband (Canvas). |
| [src/sun/SunTimeline.ts](src/sun/SunTimeline.ts) | 176 | Zeitleiste über der Karte mit Schieberegler. Stundenskala (`setBounds`) und Helligkeit (`setDay`) werden getrennt gesetzt. |
| [src/sun/SunDataPanel.ts](src/sun/SunDataPanel.ts) | 68 | Tabelle "Solardaten". |
| [src/sun/SunDateControl.ts](src/sun/SunDateControl.ts) | 72 | Menüblock "Zeitpunkt": Datumsauswahl, "Jetzt"-Knopf (⟳) und Live-Knopf. Reine Sicht, hält keinen Zustand. |
| [src/sun/EarthShadow.ts](src/sun/EarthShadow.ts) | 129 | Terminator/Erdschatten (Canvas, spaltenweise). |
| [src/ui/GridSelector.ts](src/ui/GridSelector.ts) | 72 | Menüblock "Raster". |
| [src/ui/MapLayerSelector.ts](src/ui/MapLayerSelector.ts) | 48 | Menüblock "Karten". |
| [src/ui/OptionsMenu.ts](src/ui/OptionsMenu.ts) | 28 | Ein-/Ausblenden des Seitenmenüs. |
| [src/types/qrious.d.ts](src/types/qrious.d.ts) | 26 | Ambient-Deklaration für QRious (liefert keine Typen mit). |

**Externe Abhängigkeiten** ([package.json](package.json)): `leaflet` ^1.9.4, `suncalc` ^1.9.0,
`qrious` ^4.0.2. Build: `vite` ^7, `vite-plugin-singlefile` ^2.3, `typescript` ^5.9.

---

## Build und Auslieferung

| Aspekt | Wert | Ort |
| --- | --- | --- |
| Vite-Root | `src` | [vite.config.ts:9](vite.config.ts#L9) |
| `base` | `'./'` – relative URLs, damit der Bundle unter dem Projektpfad von GitHub Pages läuft | [vite.config.ts:11](vite.config.ts#L11) |
| `publicDir` | `../public` → wird nach `/favicon` im Repo-Root kopiert | [vite.config.ts:12](vite.config.ts#L12) |
| `outDir` | `..` (= Repo-Root), `emptyOutDir: false` | [vite.config.ts:15-16](vite.config.ts#L15-L16) |
| Ziel | `es2022` | [vite.config.ts:17](vite.config.ts#L17) |
| Bundling | `viteSingleFile()` inlined JS, CSS und SVGs als Data-URIs | [vite.config.ts:18](vite.config.ts#L18) |

Ergebnis ist **[index.html](index.html) im Repo-Root** (~231 kB, 91 Zeilen). Extern bleibt nur der
Ordner `favicon/`; beide sind eingecheckt. `npm run build` = `tsc --noEmit && vite build`, d. h.
Typfehler brechen den Build ab, obwohl Vite selbst nur transpiliert.

[.githooks/pre-commit](.githooks/pre-commit) baut vor jedem Commit neu und macht `git add index.html
favicon`, sofern der Commit `src`, `public` oder eine Build-Konfiguration berührt
([Zeile 11](.githooks/pre-commit#L11) verhindert die Rebuild-Schleife). Der Hook-Pfad wird durch das
`prepare`-Skript von `npm install` gesetzt ([package.json:11](package.json#L11)).

> **Achtung:** Der Hook ruft `npm run build` auf, also auch `tsc`. Ein Commit schlägt damit bei jedem
> Typfehler fehl – auch bei einem Commit, der nur Dokumentation ändert, sofern gleichzeitig
> `src` angefasst wurde.

### Pflicht nach jeder Änderung an `src`

**Nach jeder Änderung unter `src` ist `npm run build` auszuführen** – auch ohne anschließenden
Commit. Grund: Die ausgelieferte Anwendung ist allein die generierte
[index.html](index.html) im Repo-Root. Wer sie öffnet, ohne neu zu bauen, sieht den Stand des
letzten Builds und hält eine bereits korrigierte Änderung für wirkungslos. Ein reines
`tsc --noEmit` genügt dafür **nicht**, es schreibt kein Bundle.

Wer stattdessen `npm run dev` benutzt, testet die Quellen direkt und braucht den Build erst vor dem
Commit – den erledigt dann ohnehin der Pre-Commit-Hook.

---

## Datenfluss

```
new App()                                              App.ts:51
 ├─ L.Map('map', {zoomControl:false}).setView(...)      App.ts:51   Zentrum AT, Zoom 8
 ├─ trackUserInteraction()                              App.ts:192  setzt #userIsMoving
 ├─ MapLayerSelector(#mapTypeList)                      MapLayerSelector.ts:18
 │     └─ select(MAP_LAYERS[0])                         → OSM sofort aktiv
 ├─ GridSelector(#stepList)                             GridSelector.ts:45   (kein Default!)
 ├─ DistanceCircleOverlay(CIRCLE_STEPS)                 App.ts:59
 ├─ createMarkers()                                     App.ts:75
 │     ├─ MarkerController → MarkerStore(localStorage)  MarkerStore.ts:26
 │     ├─ [Query enthält setMarkers] loadFromQueryString + history.replaceState
 │     │                                                App.ts:83-86
 │     ├─ QrCodeExport(#markerList)                     App.ts:88
 │     └─ on markerselected / homechanged / clearall    App.ts:91-100
 ├─ TimeSelection(#sunTimeline, #sunPathControl)        App.ts:61   setToNow(), beides hidden
 ├─ createSunPath()                                     App.ts:109
 │     ├─ on activechanged → circles.setEnabled(!aktiv) App.ts:115
 │     └─ on daychanged    → time.setDay(tag|null)      App.ts:118
 ├─ createWorldTime()                                   App.ts:123
 ├─ connectTimeSelection()                              App.ts:131
 │     ├─ time.daychanged      → sunPath.setDate                    App.ts:132
 │     ├─ time.momentchanged   → sunPath.setMoment + worldTime.setTime
 │     ├─ time.visibilitychanged → map.invalidateSize()             App.ts:138
 │     ├─ sunPath/worldTime.activechanged → time.setVisible(a || b) App.ts:141-143
 │     └─ time.refresh()  → Startzeitpunkt an beide Features        App.ts:146
 ├─ createGeolocation()                                 App.ts:150
 │     ├─ GeolocationTracker.positionchanged → markers.setLocation
 │     └─ DeviceOrientationTracker.headingchanged → markers.setLocationHeading
 ├─ createSearch()   → found → setView + addMarker      App.ts:173
 └─ createOptionsMenu() → toggled → invalidateSize      App.ts:182
```

Laufender Betrieb, Zeitpfad:

```
Regler ziehen / Datum wählen / ⟳            SunTimeline.ts:111 bzw. SunDateControl.ts:40/46
 └─ [beendet den Live-Modus]                TimeSelection.ts:56-69
 └─ TimeSelection.update(dayChanged)        TimeSelection.ts:172
      ├─ [dayChanged] dateControl.setDate + timeline.setBounds
      ├─ timeline.setFraction
      ├─ [dayChanged] emit 'daychanged'     → SunPath.setDate → getDayInfo (1441 Samples)
      │                                        → emit 'daychanged'(day) → timeline.setDay
      └─ emit 'momentchanged'               → SunPath.setMoment  (Sonnenstand im Peilkreis)
                                            → WorldTime.setTime  (Erdschatten + Ortszeit)

Live-Knopf                                  SunDateControl.ts:48
 └─ TimeSelection.setLive(true)             TimeSelection.ts:108
      └─ setInterval(1000 ms)
           └─ applyNow(false)               TimeSelection.ts:143  dayChanged nur um Mitternacht
                └─ update(dayChanged)       → wie oben
```

Laufender Betrieb, Markerpfad:

```
Rechtsklick / contextmenu                MarkerController.ts:163
 └─ store.add(latlng)                    MarkerStore.ts:39
      ├─ freie ID suchen, Farbe = MARKER_COLORS[(id-1) % 8]
      ├─ localStorage schreiben          MarkerStore.ts:109
      └─ emit 'changed'
           └─ MarkerController.update()  MarkerController.ts:151
                ├─ MarkerLayer.render()  MarkerLayer.ts:33
                └─ MarkerListView.render()
"H" in der Tabelle → toggleHome() → setHome()         MarkerController.ts:135/143
 └─ emit 'homechanged'(marker | null)
      ├─ DistanceCircleOverlay.setCenter(pos, farbe)  App.ts:93
      └─ SunPath.setHome(pos)                         App.ts:95
```

`toggleHome` schaltet um: "H" auf dem **aktuellen** Home-Marker macht ihn wieder zum gewöhnlichen
Marker (`setHome(null)`), "H" auf einem anderen verlegt das Home dorthin. Der Umschalter sitzt
bewusst **nicht** in `setHome`, weil `setLocation` das Home des GPS-Markers bei jeder neuen Position
neu setzt ([MarkerController.ts:115](src/markers/MarkerController.ts#L115)) – dort würde ein Toggle
das Home bei jedem Fix abschalten.

### Invarianten der Reihenfolge

1. `#circles` muss vor `createMarkers()` existieren ([App.ts:59-60](src/App.ts#L59-L60)), weil der
   `homechanged`-Handler es referenziert.
2. `#sunPath`, `#worldTime` und `#geolocation` werden **nach** `createMarkers()` gesetzt
   ([App.ts:65-68](src/App.ts#L65-L68)). Das ist nur zulässig, weil `MarkerController` im Konstruktor
   weder `homechanged` noch `clearall` feuert. Wer das ändert, bekommt einen Zugriff auf ein noch
   nicht initialisiertes `readonly`-Feld.
3. `#time` muss **vor** `createSunPath()` existieren ([App.ts:61](src/App.ts#L61)), weil der
   `daychanged`-Handler des Sonnenverlaufs darauf zugreift; `connectTimeSelection()` läuft
   umgekehrt **nach** beiden Features ([App.ts:67](src/App.ts#L67)).
4. `TimeSelection.refresh()` ist der **letzte** Schritt der Verdrahtung
   ([App.ts:146](src/App.ts#L146)). Beide Features starten mit `new Date()` als Platzhalter; erst
   `refresh()` schiebt ihnen den tatsächlich gewählten Zeitpunkt zu.
5. `loadFromQueryString()` läuft **nach** dem Registrieren des `changed`-Listeners
   ([MarkerController.ts:53](src/markers/MarkerController.ts#L53)), sonst bliebe die importierte
   Menge unsichtbar.
6. `MarkerStore` ist alleiniger Besitzer der Daten; `MarkerLayer` und `MarkerListView` sind
   zustandslos und rendern nur den übergebenen `MarkerLayerState`. Nicht persistiert und daher nur im
   Controller: GPS-Position und Home-Marker ([MarkerController.ts:40-41](src/markers/MarkerController.ts#L40-L41)).
7. `TimeSelection.update()` feuert `daychanged` **vor** `momentchanged`
   ([TimeSelection.ts:122-123](src/sun/TimeSelection.ts#L122-L123)). Nur dadurch stehen Tagesbogen
   und Jahresband des Peilkreises fest, bevor der Sonnenstand darauf gesetzt wird. Dieselbe Ordnung
   stellt `SunPath.updateDay()` intern her ([SunPath.ts:142](src/sun/SunPath.ts#L142)).

---

## Kernkonzepte

### 1. Ereignisverdrahtung statt Vererbung

Jede Feature-Klasse erbt von `TypedEventEmitter<TEvents>` und meldet Absichten nach oben;
verdrahtet wird ausschließlich in `App`. Der Emitter kopiert die Listener-Menge vor dem Iterieren
([TypedEventEmitter.ts:56](src/core/TypedEventEmitter.ts#L56)), damit sich ein Listener aus seinem
eigenen Callback abmelden darf. `on()` gibt eine Unsubscribe-Funktion zurück – im Code aktuell
nirgends verwendet, es wird nie abgemeldet.

### 2. Canvas-Overlays am Map-Container

`MapCanvasOverlay` hängt sein Canvas **an `map.getContainer()`**, nicht an eine Leaflet-Pane
([MapCanvasOverlay.ts:30](src/map/MapCanvasOverlay.ts#L30)). Folgen:

- Gezeichnet wird in **Container-Koordinaten**; die Pixelgröße bleibt zoomunabhängig.
- Neuzeichnen bei `move zoom resize viewreset` plus `ResizeObserver`
  ([Zeile 32/43](src/map/MapCanvasOverlay.ts#L32)).
- Während der Zoom-Animation ist das Canvas **ausgeblendet**, weil Container-Koordinaten dann nicht
  zuverlässig sind ([Zeile 33-41](src/map/MapCanvasOverlay.ts#L33-L41)).
- Skalierung mit `devicePixelRatio` über `setTransform`, gezeichnet wird in CSS-Pixeln
  ([Zeile 67-79](src/map/MapCanvasOverlay.ts#L67-L79)).
- `z-index` ist entscheidend: Leaflets `.leaflet-map-pane` liegt bei 400, daher liegen
  `EarthShadow` (401), `SolarTimeGrid` (402) und `SunCompass` (403) **über allen** Kartenlayern
  inklusive Marker. Die Reihenfolge ist inhaltlich gewählt: das Ortszeit-Gitter bleibt auch in der
  Nachthälfte kräftig rot, der Peilkreis bleibt oben.

### 3. Zwei Zeit-Features, eine Zeitauswahl

`SunPath` und `WorldTime` sind unabhängig schaltbar, teilen sich aber den gewählten Zeitpunkt.
Dieser Zeitpunkt gehört keinem der beiden, sondern `TimeSelection`; dort liegen Zeitleiste und
Datumsauswahl.

| | SunPath | WorldTime |
| --- | --- | --- |
| Knopf | `#toggleSunPath` (`.sun-button`, Sonne) | `#toggleWorldTime` (`.world-time-button`, beschattete Erdkugel) |
| Braucht Home-Marker | ja, sonst `disabled` | nein, immer schaltbar |
| Zeigt | Peilkreis (403), `#sunDataPanel` | Erdschatten (401), Ortszeit-Gitter (402) |
| Nebenwirkung | blendet die Entfernungskreise aus | keine |

- Sichtbar ist die Zeitauswahl, sobald **eines** der Features aktiv ist
  ([App.ts:141-143](src/App.ts#L141-L143)). `setVisible` prüft auf echten Wechsel und feuert nur dann
  `visibilitychanged`, worauf `App` genau einmal `map.invalidateSize()` ruft – die Zeitleiste nimmt
  der Karte Höhe weg.
- Die Zeitleiste kennt **keinen** Ort. Ihre Stundenskala kommt aus `setBounds` (nur das Datum), die
  Farben aus `setDay`. Nur `SunPath` kennt den Home-Marker und liefert die Farben deshalb über sein
  Event `daychanged` ([App.ts:118](src/App.ts#L118)) – und zwar **auch im ausgeschalteten Zustand**
  ([SunPath.ts:141-142](src/sun/SunPath.ts#L141-L142)), damit die Zeitleiste bei nur aktivierter
  Weltzeit ebenfalls Tag, Dämmerung und Nacht zeigt. Maßgeblich ist allein der Home-Marker: ohne ihn
  sendet `SunPath` `null` ([SunPath.ts:135](src/sun/SunPath.ts#L135)) und der Balken wird neutral
  grau. Preis dafür ist ein `getDayInfo`-Lauf (1441 Samples) je Tageswechsel, sobald ein
  Home-Marker existiert.
- `WorldTime` merkt sich den Zeitpunkt auch im ausgeschalteten Zustand
  ([WorldTime.ts:59-63](src/sun/WorldTime.ts#L59-L63)), damit das Einschalten sofort den aktuell
  gewählten Moment zeigt statt den Stand der letzten Aktivierung.

#### Live-Modus

Der Live-Knopf im Menüblock "Zeitpunkt" lässt die Auswahl der Systemuhr folgen. Der Timer gehört
`TimeSelection`, nicht der Ansicht: `SunDateControl` meldet nur den Knopfdruck (`livetoggled`) und
zeigt über `setLive()`, was ihm gesagt wird.

- `setLive(true)` startet ein `setInterval` mit `LIVE_INTERVAL` (1000 ms) und übernimmt sofort den
  aktuellen Moment ([TimeSelection.ts:108-121](src/sun/TimeSelection.ts#L108-L121)); jeder Tick läuft
  über `applyNow(false)` und damit über denselben Pfad wie der ⟳-Knopf.
- **`applyNow` meldet den Tageswechsel nur, wenn der lokale Tag wirklich wechselt.** `setToNow()`
  (⟳ und Start) erzwingt ihn mit `true`, der Live-Tick nicht. Sonst würde jede Sekunde
  `daychanged` → `SunPath.setDate` → `getDayInfo` mit 1441 Samples laufen; so fällt diese Rechnung
  nur um Mitternacht an ([TimeSelection.ts:143-151](src/sun/TimeSelection.ts#L143-L151)).
- Jede Handbedienung beendet den Modus – Regler ziehen, Datum wählen, ⟳
  ([TimeSelection.ts:56-69](src/sun/TimeSelection.ts#L56-L69)). Ohne das würde der nächste Tick die
  eben getroffene Wahl sofort überschreiben.
- `setVisible(false)` schaltet den Modus ebenfalls ab: sind beide Features aus, hört niemand mehr zu,
  und der versteckte Knopf ließe sich nicht mehr bedienen.

### 4. Sonnengeometrie ([SolarAstronomy.ts](src/sun/SolarAstronomy.ts))

Alle Ereigniszeiten werden **durch Abtasten der Sonnenhöhe** bestimmt, nicht über
`SunCalc.getTimes()`. Grund: `getTimes()` liefert bei Polartag/Polarnacht ungültige Daten, weil der
Stundenwinkel dort undefiniert ist ([Doc-Kommentar Zeile 8-11](src/sun/SolarAstronomy.ts#L8-L11)).

| Schritt | Funktion | Details |
| --- | --- | --- |
| Abtasten | `sampleDay` [:130](src/sun/SolarAstronomy.ts#L130) | lokale Mitternacht → lokale Mitternacht, Schritt 1 min ⇒ **1441 Samples** (bei Zeitumstellung 1381 bzw. 1501). |
| Auf-/Untergang | `findEvents` [:151](src/sun/SolarAstronomy.ts#L151) | lineare Interpolation der Schwellenkreuzung zwischen zwei Samples; liefert zusätzlich `alwaysAbove`/`alwaysBelow`. |
| Höchststand | `findCulmination` [:191](src/sun/SolarAstronomy.ts#L191) | Parabelscheitel durch Maximum und seine zwei Nachbarn. |
| Tagesbogen | `getDayArc` [:297](src/sun/SolarAstronomy.ts#L297) | abgetastet über einen **Sonnentag** (Sonnenmittag ±12 h), nicht über den lokalen Tag – sonst zerschneidet die lokale Mitternacht den Tagbogen entfernter Orte. |
| Azimut | `getSample` [:118](src/sun/SolarAstronomy.ts#L118) | SunCalc misst ab Süden, hier wird auf "im Uhrzeigersinn ab Nord" umgerechnet. |
| Sonnenmeridian | `getSubsolarLongitude` [:368](src/sun/SolarAstronomy.ts#L368) | Länge mit Stundenwinkel 0, also `rektaszension − sternzeit`, normiert auf [−180°, 180°). Die Zeitgleichung steckt bereits in der Rektaszension, das Ergebnis folgt daher der **wahren** Sonne. |

`getEquatorialPosition` [:341](src/sun/SolarAstronomy.ts#L341) rechnet dieselben Formeln wie SunCalc
nach, aber im äquatorialen System; `days` ist die SunCalc-Tageszählung ab J2000
(`2440588 − 2451545 = −10957`, [Zeile 342](src/sun/SolarAstronomy.ts#L342)).

### 5. Erdschatten analytisch pro Spalte ([EarthShadow.ts](src/sun/EarthShadow.ts))

Entlang eines Meridians ist die Länge konstant, damit gilt

```
sin(h) = sin(φ)·sin(δ) + cos(φ)·cos(δ)·cos(H) = K·sin(φ + ψ)
mit K = hypot(a, b), ψ = atan2(b, a), a = sin(δ), b = cos(δ)·cos(H)
```

`getDarkLatitudeRanges` [:387](src/sun/SolarAstronomy.ts#L387) löst das nach φ auf und liefert die
dunklen Breitenbereiche – inklusive der Sonderfälle "ganzer Meridian hell/dunkel"
(`ratio ≥ 1` bzw. `≤ −1`, [Zeile 393-394](src/sun/SolarAstronomy.ts#L393-L394)).

Gezeichnet wird spaltenweise mit `COLUMN_WIDTH = 2` px und **zwei** Schwellen (−0.833° und −6°).
Jede Schwelle ist **ein** Pfad, damit überlappende Rechtecke derselben Stufe nicht doppelt
abdunkeln ([Zeile 61-84](src/sun/EarthShadow.ts#L61-L84)). Ergebnis: Dämmerung eine Lage
(α = 0.11), Nacht zwei Lagen ⇒ effektiv 1 − 0.89² = **0.208**.

Die Umrechnung x↔Länge und Breite↔y erfolgt über eine **lineare** Ersatzprojektion aus zwei
Referenzpunkten ([getProjection :94](src/sun/EarthShadow.ts#L94)), weil in Web-Mercator die Länge
linear in x und die Mercator-Breite linear in y ist. Das spart einen Projektionsaufruf pro Spalte.

### 6. Peilkreis ([SunCompass.ts](src/sun/SunCompass.ts))

Orthografische Abbildung des Himmels: Höhe *h* wird im Abstand `radius · cos(h)` vom Mittelpunkt
gezeichnet ([getPoint :108](src/sun/SunCompass.ts#L108)) – Horizont auf dem Kreis, Zenit im
Zentrum. Punkte **unter** dem Horizont landen pauschal auf `radius + 7` px, also knapp außerhalb.

Das Jahresband (Fläche, die die Sonne über das Jahr überstreicht) entsteht aus den beiden
Solstitienbögen: beide werden als geschlossene Regionen "unter dem Bogen" in **einen** Pfad
gelegt und mit der **Even-Odd-Regel** gefüllt ([drawYearRange :118](src/sun/SunCompass.ts#L118)).
Damit füllt sich exakt die Differenzfläche, ohne dass entschieden werden muss, welcher Bogen höher
läuft. `appendRegion` [:134](src/sun/SunCompass.ts#L134) schließt die Region entlang des Horizonts;
die Drehrichtung (`turning`) bestimmt, in welche Richtung der Kreisbogen läuft.

### 7. Entfernungskreise: nur sichtbare Radien ([DistanceCircleOverlay.ts](src/map/DistanceCircleOverlay.ts))

Der Abstand ergibt sich aus dem ersten `CIRCLE_STEPS`-Eintrag mit `minZoom <= zoom`
([Zeile 89](src/map/DistanceCircleOverlay.ts#L89)); die Liste in
[App.ts:23-33](src/App.ts#L23-L33) ist deshalb **von fein nach grob** sortiert – eine Umsortierung
ändert das Verhalten stillschweigend.

`getVisibleRadiusRange` [:117](src/map/DistanceCircleOverlay.ts#L117): liegt das Zentrum im
Ausschnitt, ist `min = step` und `max` die Distanz zur entferntesten Ecke. Liegt es außerhalb, ist
`min` auf den nächsten Punkt des Rechtecks abgerundet – alle kleineren Kreise sind vollständig
außerhalb. Jeder fünfte Kreis (`radius % (5·step) == 0`) wird mit Strichstärke 2 gezeichnet.

Beschriftungen ([DistanceCircleLabels.ts:51-59](src/map/DistanceCircleLabels.ts#L51-L59)) sitzen auf
dem Meridian des Zentrums sowie an den Schnittpunkten mit dem **oberen** Kartenrand, berechnet über
den Stundenwinkel; ist `|cos H| > 1`, schneidet der Kreis den Rand nicht und die Labels entfallen.

### 8. Gitter

`MapGrid` besitzt eine `L.layerGroup` per Komposition statt sie zu erweitern
([Doc-Kommentar :12-20](src/map/grids/MapGrid.ts#L12-L20)) und baut bei `viewreset move`
**alle** Layer neu ([Zeile 52/76](src/map/grids/MapGrid.ts#L52)).

- `DegreeGrid`: Abstand in Bogensekunden, `step = spacing / 3600`
  ([Zeile 17](src/map/grids/DegreeGrid.ts#L17)). Labels werden um 3 % nach innen gerückt
  (`pad(-0.03)`), damit sie lesbar bleiben. `formatCoordinate`
  [:48](src/map/grids/DegreeGrid.ts#L48) lässt Null-Anteile weg ("13°E" statt "13°0'0\"E").
- `MetricGrid`: legt die Linien im **Spherical-Mercator-Plan** aus, ausgehend von der Kartenmitte.
  Korrektur `step = spacing / |cos(lat_mitte)|` ([Zeile 26](src/map/grids/MetricGrid.ts#L26)),
  weil Mercator-Strecken um 1/cos(φ) gedehnt sind. Der Abstand stimmt daher **exakt nur auf der
  Breite der Kartenmitte**.
- `SolarTimeGrid`: siehe unten. Trotz des Namens **kein** `MapGrid`, sondern ein Canvas-Overlay, und
  nicht über das Menü "Raster" erreichbar, sondern Teil der Weltzeit.

### 9. Gitter der wahren Ortszeit ([SolarTimeGrid.ts](src/sun/SolarTimeGrid.ts))

Fachlich ein Längengitter mit 15° Abstand, verankert am **Sonnenmeridian**
(`getSubsolarLongitude`). Dort ist der Stundenwinkel 0, also wahre Ortszeit 12 h; jede weitere
Linie nach Osten ist eine Stunde später. Der Index `hour` zählt die Linien ab dem Sonnenmeridian,
die Beschriftung ist `((12 + hour) mod 24)`
([Zeile 71](src/sun/SolarTimeGrid.ts#L71)). Weil sich die Erde in einer Stunde um 15° dreht, fällt
eine Weltkopie (+360°) genau auf ein Vielfaches von 24 Stunden – deshalb wird die dicke Mittagslinie
über `clock === 12` erkannt und nicht über `hour === 0`; in gekachelten Weltkopien stimmt damit auch
die Strichstärke.

Gezeichnet wird als `MapCanvasOverlay` in **Container-Koordinaten**, nicht als Leaflet-Layer:

- **Grund:** Leaflet klemmt in `SphericalMercator.project` jede Breite auf ±85,0511°. Ein an einer
  Position verankertes Label (`L.marker`) rutscht deshalb auf den oberen Rand der *Weltkarte*,
  sobald der Nutzer darüber hinausschiebt – die Beschriftung wanderte mit der Karte nach unten. In
  Container-Koordinaten sitzt sie stattdessen fix `LABEL_TOP` Pixel unter dem oberen Rand der
  *Ansicht*, unabhängig von Zoom und Verschiebung.
- Die x-Position folgt derselben linearen Ersatzprojektion wie der Erdschatten: in Web-Mercator ist
  die Länge linear in x, zwei Referenzpunkte genügen ([Zeile 56-57](src/sun/SolarTimeGrid.ts#L56-L57)).
  Die Linien laufen über die **volle Höhe** der Ansicht, also auch über den Bereich jenseits der
  Mercator-Grenze.
- Die Linien werden in **zwei** Pfaden gezeichnet, einer je Strichstärke, weil `lineWidth` eine
  Eigenschaft des Kontexts und nicht des Pfades ist ([Zeile 67](src/sun/SolarTimeGrid.ts#L67)).
  Das `+ 0.5` auf der x-Position hält Linien ungerader Breite auf dem Pixelraster.
- Die weiße Kontur der Beschriftung entsteht aus `strokeText` **vor** `fillText`
  ([drawLabels :92](src/sun/SolarTimeGrid.ts#L92)) und ersetzt den `text-shadow` der übrigen
  Gitterlabels. Alle Konturen werden vor allen Füllungen gezeichnet, damit die Kontur eines Labels
  nicht in das Nachbarlabel hineinragt.
- Das Gitter hängt am **gewählten Moment**, nicht nur an der Kartenansicht: `WorldTime.setTime()`
  reicht ihn durch ([WorldTime.ts:63](src/sun/WorldTime.ts#L63)). Beim Ziehen des Zeitreglers wandert
  das Gitter also nach Westen.

---

## Konstanten-Referenz

### [src/App.ts](src/App.ts)

| Konstante | Zeile | Bedeutung / Herkunft |
| --- | --- | --- |
| `INITIAL_VIEW` | [17](src/App.ts#L17) | `[47.5, 13.5]`, Zoom 8 – Mitte Österreichs, willkürlich gewählt. |
| `LOCATION_ZOOM` | [20](src/App.ts#L20) | 14; Zoom nach dem ersten GPS-Fix. |
| `CIRCLE_STEPS` | [23-33](src/App.ts#L23-L33) | 100 m (ab Z16) … 1000 km (ab Z0). Reihenfolge fein→grob ist bindend. |

### Marker

| Konstante | Ort | Bedeutung |
| --- | --- | --- |
| `MARKER_COLORS` | [MarkerTypes.ts:19](src/markers/MarkerTypes.ts#L19) | 8 Farben; ID 9 bekommt wieder rot (`(id-1) % 8`). |
| `LOCATION_COLOR` | [MarkerTypes.ts:23](src/markers/MarkerTypes.ts#L23) | `#007bff`, zugleich Default der Kreisfarbe ([DistanceCircleOverlay.ts:36](src/map/DistanceCircleOverlay.ts#L36)). |
| `STORAGE_KEY` | [MarkerStore.ts:12](src/markers/MarkerStore.ts#L12) | `customMarkers` in `localStorage`. |
| `LONG_PRESS_MS` | [MarkerController.ts:27](src/markers/MarkerController.ts#L27) | 600 ms – **wirkungslos**, siehe Fallstricke. |
| `MARKER_QUERY_PARAMETER` | [MarkerUrlCodec.ts:4](src/markers/MarkerUrlCodec.ts#L4) | `setMarkers`. |
| `#COLOR_PATTERN` | [MarkerUrlCodec.ts:20](src/markers/MarkerUrlCodec.ts#L20) | `^#?[0-9a-zA-Z]{3,20}$` – **die Sicherheitsgrenze** gegen HTML-Injektion aus der URL. |
| `QR_SIZE` | [QrCodeExport.ts:5](src/markers/QrCodeExport.ts#L5) | 250 px Kantenlänge. |

### Geometrie und Sonne

| Konstante | Ort | Bedeutung |
| --- | --- | --- |
| `EARTH_RADIUS` | [Geo.ts:5](src/core/Geo.ts#L5) | 6.371.000 m. Identisch mit `L.CRS.Earth.R`, deshalb passen die Label-Radien exakt zu `map.distance()`. |
| `EMPHASIS_INTERVAL` | [DistanceCircleOverlay.ts:21](src/map/DistanceCircleOverlay.ts#L21) | 5 – jeder fünfte Kreis dicker. |
| `MIN_ZOOM` (metrisch) | [MetricGrid.ts:5](src/map/grids/MetricGrid.ts#L5) | 3; darunter liefert das metrische Gitter zu viele Linien. |
| `GRID_LINE_STYLE` | [MapGrid.ts:4](src/map/grids/MapGrid.ts#L4) | `#111`, Opazität 0.6, `interactive: false`. |
| `SUNRISE_ALTITUDE` | [SolarAstronomy.ts:18](src/sun/SolarAstronomy.ts#L18) | −0.833° = Refraktion + scheinbarer Sonnenradius (Standarddefinition). |
| `TWILIGHT_ALTITUDE` | [SolarAstronomy.ts:20](src/sun/SolarAstronomy.ts#L20) | −6° = bürgerliche Dämmerung. |
| `OBLIQUITY` | [SolarAstronomy.ts:22](src/sun/SolarAstronomy.ts#L22) | 23.4397°, Wert aus SunCalc. |
| `MERCATOR_LIMIT` | [SolarAstronomy.ts:24](src/sun/SolarAstronomy.ts#L24) | 85.0511° (Leaflet selbst rechnet mit 85.0511287798 – für die Schattenkante irrelevant). |
| `HOME_TOLERANCE` | [SunPath.ts:24](src/sun/SunPath.ts#L24) | 0.0005° ≈ **56 m** in der Breite; darunter gilt der Home-Punkt als unverändert. |
| `PADDING` | [SunCompass.ts:7](src/sun/SunCompass.ts#L7) | 30 px Abstand des Peilkreises zum Kartenrand. |
| `HOUR_SPACING` | [SolarTimeGrid.ts:6](src/sun/SolarTimeGrid.ts#L6) | 15° = eine Stunde Erddrehung. Andere Werte ergeben keine ganzen Stunden und damit falsche Beschriftungen. |
| `MAX_LINES` | [SolarTimeGrid.ts:9](src/sun/SolarTimeGrid.ts#L9) | 100 Meridiane, Notbremse bei Ansichten mit vielen Weltkopien. |
| `LINE_COLOR`, `NOON_WIDTH`, `HOUR_WIDTH` | [SolarTimeGrid.ts:12-16](src/sun/SolarTimeGrid.ts#L12-L16) | `#d40000`; Stundenlinien 1 px, die 12h-Linie 3 px. |
| `LABEL_TOP` | [SolarTimeGrid.ts:20](src/sun/SolarTimeGrid.ts#L20) | 6 px unter dem oberen Rand der **Ansicht** – dieser feste Pixelwert ist der Grund für das Canvas. |
| `COLUMN_WIDTH` | [EarthShadow.ts:10](src/sun/EarthShadow.ts#L10) | 2 px pro Scan-Spalte. |
| `SHADOW_COLOR` | [EarthShadow.ts:12](src/sun/EarthShadow.ts#L12) | `rgba(0,6,30,0.11)`; zwei Lagen ergeben 0.208 für die Nacht. |
| `LIVE_INTERVAL` | [TimeSelection.ts:15](src/sun/TimeSelection.ts#L15) | 1000 ms Taktrate des Live-Modus. Ein kleinerer Wert lohnt nicht: die Zeitleiste zeigt nur Minuten, gezeichnet wird aber der volle Erdschatten. |
| `HOUR_LABEL_WIDTH` | [SunTimeline.ts:22](src/sun/SunTimeline.ts#L22) | 55 px – bestimmt, wie stark die Stundenbeschriftung ausgedünnt wird. |
| `CLASS_COLORS` | [SunTimeline.ts:14](src/sun/SunTimeline.ts#L14) | Nacht `#2f4468`, Dämmerung `#b9d9f0`, Tag `#ffe89e`. |
| `NO_DATA_COLOR` | [SunTimeline.ts:19](src/sun/SunTimeline.ts#L19) | `#7d8794` – Balkenfarbe ohne Solardaten, also solange kein Home-Marker gesetzt ist. |
| `UPDATE_INTERVAL` | [GeolocationTracker.ts:14](src/geolocation/GeolocationTracker.ts#L14) | 500 ms Mindestabstand zwischen zwei Positionen. |

### Menüeinträge

- `MAP_LAYERS` [MapLayerCatalog.ts:18-79](src/map/MapLayerCatalog.ts#L18-L79): 12 Basemaps.
  Reihenfolge = Menüreihenfolge, **Index 0 (OSM) wird beim Start automatisch aktiviert**
  ([MapLayerSelector.ts:24](src/ui/MapLayerSelector.ts#L24)).
- `GRID_CHOICES` [GridSelector.ts:16-29](src/ui/GridSelector.ts#L16-L29): 12 Abstufungen von 10°
  (36000") bis 1", **ausschließlich `kind: 'degrees'`**.

---

## Externe Systeme

| Dienst | Aufruf | Bemerkung |
| --- | --- | --- |
| Tile-Server (12 Quellen) | `L.tileLayer` [MapLayerSelector.ts:39](src/ui/MapLayerSelector.ts#L39) | Layer werden **lazy** erzeugt und danach im `Map<Definition, TileLayer>` behalten, damit ein Zurückwechseln den Tile-Cache nutzt. Kein `attribution` gesetzt. Die Google-Luftbild-URL (`{s}.google.com/vt`) ist eine inoffizielle Endpunktform. |
| Nominatim | `GET https://nominatim.openstreetmap.org/search?q=…&format=json` [AddressSearch.ts:16/40-44](src/search/AddressSearch.ts#L40-L44) | Nur der **erste** Treffer wird verwendet. Kein Timeout, kein Retry, keine Entprellung; Nominatims Nutzungsbedingungen (max. 1 Anfrage/s) werden nicht aktiv eingehalten. |
| Geolocation-API | `watchPosition({enableHighAccuracy: true})` [GeolocationTracker.ts:51](src/geolocation/GeolocationTracker.ts#L51) | Positionen werden verworfen, solange der Nutzer die Karte bewegt (`shouldIgnore`, [Zeile 79](src/geolocation/GeolocationTracker.ts#L79)) oder seit dem letzten Update < 500 ms vergangen sind. |
| DeviceOrientation | `deviceorientationabsolute`, sonst `deviceorientation` [DeviceOrientationTracker.ts:24](src/geolocation/DeviceOrientationTracker.ts#L24) | Nur `…absolute` bzw. Safaris `webkitCompassHeading` sind nordbezogen; sonst wird um `screen.orientation.angle` korrigiert ([Zeile 42](src/geolocation/DeviceOrientationTracker.ts#L42)). |
| Zwischenablage | `navigator.clipboard.writeText` [QrCodeExport.ts:57](src/markers/QrCodeExport.ts#L57) | Klick auf den QR-Code; Erfolg und Fehler werden per `alert()` gemeldet. |
| `localStorage` | [MarkerStore.ts:94/109](src/markers/MarkerStore.ts#L109) | Einziger persistenter Zustand. Kartenauswahl, Rasterwahl und Home-Marker werden **nicht** gespeichert. |

---

## Marker-Export/-Import

Format ([MarkerUrlCodec.ts:26-53](src/markers/MarkerUrlCodec.ts#L26-L53)):

```
?setMarkers=<id>_<farbe>_<lat_µ°>_<lng_µ°>$<id>_…
Beispiel: ?setMarkers=1_red_47820532_10892944$2_green_47720849_11771851
```

- Koordinaten als **ganzzahlige Mikrograd** ⇒ Auflösung 1e-6° ≈ **0,11 m**.
- `#` in Hex-Farben wird zu `%23` escaped, sonst begänne das URL-Fragment
  ([Zeile 30](src/markers/MarkerUrlCodec.ts#L30)).
- Beim Dekodieren werden fehlerhafte Einträge **übersprungen**, nicht als NaN-Marker angelegt;
  Farben müssen `#COLOR_PATTERN` erfüllen.
- Der Import **ersetzt** den lokalen Bestand vollständig und schreibt ihn in `localStorage`
  ([MarkerStore.ts:81-83](src/markers/MarkerStore.ts#L81-L83)). Danach entfernt
  [App.ts:84-85](src/App.ts#L84-L85) den Querystring per `history.replaceState`, damit ein Reload
  den geteilten Satz nicht erneut aufzwingt.
- Der QR-Code enthält `protocol//host + pathname + ?setMarkers=…`
  ([QrCodeExport.ts:42-43](src/markers/QrCodeExport.ts#L42-L43)) – ein vorhandener Querystring der
  aktuellen Seite geht dabei verloren, was hier erwünscht ist.

---

## Fehlerbehandlung

| Situation | Verhalten | Ort |
| --- | --- | --- |
| Erwartetes DOM-Element fehlt | `Error` beim Start, App bootet nicht | [Dom.ts:12](src/core/Dom.ts#L12) |
| `localStorage` defekt / kein JSON-Array | leerer Markersatz, kein Hinweis | [MarkerStore.ts:92-105](src/markers/MarkerStore.ts#L92-L105) |
| `localStorage` voll / im Privatmodus gesperrt | **ungefangen** – `setItem` wirft und reißt `add()`/`remove()` mit | [MarkerStore.ts:109](src/markers/MarkerStore.ts#L109) |
| Fehlerhafter Eintrag im Querystring | Eintrag wird still übersprungen | [MarkerUrlCodec.ts:45-50](src/markers/MarkerUrlCodec.ts#L45-L50) |
| Nominatim: HTTP-Fehler / kein Treffer / Netzfehler | Fehlertext wird **in das Suchfeld selbst** geschrieben | [AddressSearch.ts:52-54](src/search/AddressSearch.ts#L52-L54) |
| Geolocation nicht unterstützt | `failed` + `start()` liefert `false`, Button bleibt inaktiv | [GeolocationTracker.ts:45-48](src/geolocation/GeolocationTracker.ts#L45-L48) |
| Geolocation-Berechtigung verweigert / Timeout | nur `console.warn`; **Tracking bleibt formal aktiv**, Button bleibt eingefärbt | [App.ts:162](src/App.ts#L162) |
| Zwischenablage verweigert | `alert()` mit Fehlermeldung | [QrCodeExport.ts:59-61](src/markers/QrCodeExport.ts#L59-L61) |
| Markersatz zu groß für einen QR-Code | **ungefangen** – QRious wirft in `show()`, das Canvas wird nie angehängt, `#canvas` bleibt `null` (nächster Klick versucht es erneut). Grenze rechnerisch ~2953 Byte, bei ~28 Byte je Marker also grob 100 Marker | [QrCodeExport.ts:50](src/markers/QrCodeExport.ts#L50) |
| Kein Home-Marker | Sonnen-Button ist `disabled`, Titel "Kein Marker als Home definiert". Der Weltzeit-Button bleibt bedienbar, die Zeitleiste bleibt ungefärbt. | [SunPath.ts:112-115](src/sun/SunPath.ts#L112-L115) |
| Polartag/Polarnacht/Dauerdämmerung | Zeiten sind `null` → "–", zusätzlich ein Hinweistext | [SunDataPanel.ts:62-66](src/sun/SunDataPanel.ts#L62-L66) |
| Kartencontainer hat Größe 0 | Canvas-Redraw bricht ab | [MapCanvasOverlay.ts:65](src/map/MapCanvasOverlay.ts#L65) |

Es gibt **kein** Logging-Framework; die einzige Diagnoseausgabe ist das `console.warn` in
[App.ts:162](src/App.ts#L162).

---

## Erweiterungspunkte

**Neue Basemap** — Eintrag in `MAP_LAYERS`
([MapLayerCatalog.ts:18](src/map/MapLayerCatalog.ts#L18)). Titel und URL stehen bewusst an einer
Stelle; die Menüzeile entsteht daraus automatisch. Beachten: `minZoom`/`maxZoom` gehören zwingend
dazu, sonst fordert Leaflet Kacheln an, die der Server nicht liefert. Index 0 ist die Startkarte.

**Metrisches Raster ins Menü holen** — `GRID_CHOICES`
([GridSelector.ts:16](src/ui/GridSelector.ts#L16)) um Einträge mit `kind: 'metric'` und `spacing` in
Metern ergänzen. `GridSelector.select` [:63](src/ui/GridSelector.ts#L63) tauscht die Gitterklasse nur
beim Wechsel der `kind`, innerhalb derselben Art wird nur `setSpacing` gerufen. `MetricGrid` ist
vollständig implementiert, über die Oberfläche aber nicht erreichbar.

**Raster abschaltbar machen** — es gibt derzeit **keinen** Weg zurück: `GridSelector` besitzt keinen
"Aus"-Eintrag und `MapGrid.remove()` [:58](src/map/grids/MapGrid.ts#L58) wird nur beim
Gitterwechsel gerufen. Nötig wäre ein Choice-Eintrag mit `kind: null` plus eine Verzweigung in
`select`.

**Andere Kreisabstände** — `CIRCLE_STEPS` in [App.ts:23](src/App.ts#L23). Die Liste **muss** von
fein nach grob sortiert bleiben, weil `find()` den ersten passenden Eintrag nimmt
([DistanceCircleOverlay.ts:89](src/map/DistanceCircleOverlay.ts#L89)). Der Hervorhebungsfaktor 5
steckt separat in `EMPHASIS_INTERVAL`.

**Weitere Solardaten-Zeile** — `rows` in [SunDataPanel.ts:45-53](src/sun/SunDataPanel.ts#L45-L53).
Wenn der Wert nicht schon in `SolarDayInfo` steht, muss er zusätzlich in `getDayInfo`
[:218](src/sun/SolarAstronomy.ts#L218) berechnet und in das Interface
[:56-75](src/sun/SolarAstronomy.ts#L56-L75) aufgenommen werden.

**Nautische/astronomische Dämmerung** — `TWILIGHT_ALTITUDE`
([SolarAstronomy.ts:20](src/sun/SolarAstronomy.ts#L20)) ändern reicht **nicht**: der Wert wird an
drei Stellen als *die eine* Dämmerungsschwelle benutzt (Solardaten, Zeitleistenfarben
[SunTimeline.ts:157](src/sun/SunTimeline.ts#L157), Erdschatten-Stufen
[EarthShadow.ts:56-59](src/sun/EarthShadow.ts#L56-L59)). Für mehrere Stufen muss aus der Konstanten
eine Liste werden; `EarthShadow` verträgt beliebig viele Schwellen bereits, da es über
`thresholds` iteriert.

**Marker-Zusatzfeld (z. B. Name)** — vier Stellen ziehen mit: `MapMarker`
([MarkerTypes.ts:2](src/markers/MarkerTypes.ts#L2)), die Validierung in `MarkerStore.read`
[:98-102](src/markers/MarkerStore.ts#L98-L102), das URL-Format in **beiden** Richtungen
([MarkerUrlCodec.ts:26/40](src/markers/MarkerUrlCodec.ts#L26)) und die Tabelle
([MarkerListView.ts:62/81-84](src/markers/MarkerListView.ts#L81-L84), Spaltenbreiten im Header sind
hartkodiert). Das URL-Format hat **keine Version** – ältere Links mit vier Feldern müssten
weiterhin dekodierbar bleiben.

**Ortszeit-Gitter feiner rastern** — `HOUR_SPACING`
([SolarTimeGrid.ts:6](src/sun/SolarTimeGrid.ts#L6)) ist an die Stundenbeschriftung gekoppelt: der
Linienindex `hour` **ist** der Stundenversatz. Für z. B. halbe Stunden (7,5°) müsste die
Beschriftung in [Zeile 71](src/sun/SolarTimeGrid.ts#L71) auf Stunden **und** Minuten umgestellt und
das Kriterium der Mittagslinie (`clock === 12`) entsprechend angepasst werden.

**Zusätzliches Canvas-Overlay** — von `MapCanvasOverlay`
([MapCanvasOverlay.ts:12](src/map/MapCanvasOverlay.ts#L12)) ableiten, `draw(context, size)`
implementieren und einen `zIndex` > 400 wählen (belegt: 401 Erdschatten, 402 Ortszeit-Gitter,
403 Peilkreis, 1000 Menü-Button in [index.css:153](src/styles/index.css#L153)).

**Neues Menüfeld** — Markup in [src/index.html](src/index.html) ergänzen und in `App` per
`requireElement` holen. Das Menü ist ein Flex-Container, dessen direkte Kinder gerahmt werden
([index.css:42](src/styles/index.css#L42)).

**Weiteres zeitabhängiges Feature** — nach dem Muster von `WorldTime`
([WorldTime.ts](src/sun/WorldTime.ts), 78 Zeilen) bauen: eigener Knopf in `.controlButtons`, eine
`setTime(Date)`-Methode und ein `activechanged`-Event. In `App.connectTimeSelection`
([App.ts:131](src/App.ts#L131)) an `momentchanged` hängen und in `updateControls` mit `|| …`
aufnehmen, damit die Zeitauswahl auch für dieses Feature erscheint. Den Zeitpunkt **nicht** selbst
aus `new Date()` holen – er kommt ausschließlich aus `TimeSelection`.

---

## Fallstricke

1. **Der eigene Long-Press-Timer ist toter Code.** `map.on('touchstart' | 'touchend', …)`
   ([MarkerController.ts:166/175](src/markers/MarkerController.ts#L166)) feuert nie: Leaflet leitet
   vom Container nur `click dblclick mousedown mouseup mouseover mouseout mousemove contextmenu
   keypress keydown keyup` als Map-Events weiter. Dass Long-Press auf Mobilgeräten trotzdem
   funktioniert, liegt am `contextmenu`-Handler
   ([Zeile 163](src/markers/MarkerController.ts#L163)) – Android-Browser feuern beim langen Drücken
   ein natives `contextmenu`, mobiles Safari bekommt es über Leaflets eigenen `TapHold`-Handler
   simuliert (ebenfalls 600 ms). `LONG_PRESS_MS` ist damit wirkungslos.

2. **Doppelklick tut zwei Dinge.** [App.ts:104](src/App.ts#L104) setzt bei `dblclick` den GPS-Pfeil
   auf die geklickte Position; Leaflets `doubleClickZoom` ist gleichzeitig aktiv, die Karte zoomt
   also mit. Das ist ein bewusster Testpfad ohne echtes GPS, überrascht aber.

3. **`DegreeGrid` hat keine Zoomgrenze.** Anders als `MetricGrid` (`MIN_ZOOM = 3`) prüft
   [DegreeGrid.createLayers](src/map/grids/DegreeGrid.ts#L16) den Zoom nicht. Ein 1"-Raster bei
   Zoom 8 erzeugt pro Achse Tausende `L.polyline`-Layer **plus** ebenso viele Label-Marker und friert
   den Browser ein. Zusätzlich läuft der Neuaufbau an `move`
   ([MapGrid.ts:52](src/map/grids/MapGrid.ts#L52)), also während des Ziehens in jedem Frame.

4. **QR-Code wird nicht nachgeführt.** `show()` läuft nur aus `toggle()`
   ([QrCodeExport.ts:27](src/markers/QrCodeExport.ts#L27)). Wer bei sichtbarem Code einen Marker
   ergänzt, sieht weiter den alten Link. Nur `clearall` blendet ihn aus
   ([App.ts:99](src/App.ts#L99)).

5. **Import mit ID 0 kollidiert mit dem GPS-Marker.** `decode` akzeptiert jede endliche ID
   ([MarkerUrlCodec.ts:49](src/markers/MarkerUrlCodec.ts#L49)), auch 0 oder negative Werte und
   Duplikate. Der GPS-Marker hat fest ID 0 ([MarkerTypes.ts:13](src/markers/MarkerTypes.ts#L13));
   `MarkerLayer.renderHomeLines` [:56](src/markers/MarkerLayer.ts#L56) und die Home-Vergleiche
   arbeiten über die ID und werden dann uneindeutig. Auch die Vergabe der nächsten freien ID
   ([MarkerStore.ts:40-44](src/markers/MarkerStore.ts#L40-L44)) setzt aufsteigende, eindeutige IDs
   ab 1 voraus.

6. **Farben aus `localStorage` werden nicht validiert.** `MarkerStore.read`
   [:98-102](src/markers/MarkerStore.ts#L98-L102) prüft nur `id`, `lat`, `lng`. `MarkerLayer`
   interpoliert `marker.color` dagegen in HTML
   ([Zeile 41](src/markers/MarkerLayer.ts#L41)). Für den URL-Pfad greift `#COLOR_PATTERN`, für den
   Storage-Pfad nichts – praktisch unkritisch (Same-Origin), aber die Prüfung gehört bei einer
   Erweiterung in `read()`.

7. **`SunPath.activechanged` feuert bei jedem `updateVisibility()`,** auch ohne Zustandswechsel
   ([SunPath.ts:121](src/sun/SunPath.ts#L121)). `App` löst daraus jedes Mal ein Neuzeichnen der
   Entfernungskreise aus ([App.ts:115](src/App.ts#L115)). `WorldTime` verhält sich anders: dort
   bricht `setActive` bei gleichem Wert vorher ab ([WorldTime.ts:49](src/sun/WorldTime.ts#L49)).

8. **Sonnenverlauf blendet die Entfernungskreise aus** – bewusst, weil sie den Peilkreis überdecken
   würden ([App.ts:114-115](src/App.ts#L114-L115)). Das Zentrum bleibt dabei erhalten
   (`setEnabled`, nicht `clear`), Kreise kommen beim Abschalten unverändert zurück. Die **Weltzeit**
   tut das nicht – bei ihr bleiben die Kreise sichtbar.

9. **Alle Uhrzeiten sind in der Zeitzone des Nutzers,** auch wenn der Home-Marker auf einem anderen
   Kontinent liegt ([SunDataPanel.ts:6-7](src/sun/SunDataPanel.ts#L6-L7)). Die Zeitleiste spannt
   lokale Mitternacht bis lokale Mitternacht, Tage mit Zeitumstellung sind 23 bzw. 25 h lang und
   werden korrekt auf 0..1 abgebildet ([SunTimeline.ts:120-122](src/sun/SunTimeline.ts#L120-L122));
   die übersprungene Stunde wird beim Zeichnen der Skala abgefangen
   ([Zeile 136](src/sun/SunTimeline.ts#L136)).

10. **`web app manifest` verweist ins Leere.** In
    [public/favicon/site.webmanifest](public/favicon/site.webmanifest) lauten die Icon-Pfade
    `favicon/android-chrome-…`, relativ zum Manifest ergibt das `/favicon/favicon/…`. Außerdem sind
    `name` und `short_name` leer. Trotz `display: standalone` gibt es keinen Service Worker, also
    keine Offline-Fähigkeit.

11. **Der metrische Gittermaßstab bezieht sich auf den Äquatorradius.** `SphericalMercator` rechnet
    mit R = 6.378.137 m, `map.distance()` mit 6.371.000 m. Ein "1000 m"-Gitter ist daher rund
    0,11 % weiter als die gemessene Distanz.

12. **Kein iOS-Permission-Flow für den Kompass.** `DeviceOrientationEvent.requestPermission()` wird
    nirgends gerufen; auf iOS 13+ liefert der Kompass deshalb keine Daten, ohne dass ein Hinweis
    erscheint.

13. **Das Ortszeit-Gitter hängt nicht am Menü "Raster".** Es wird allein von der Weltzeit ein- und
    ausgeschaltet ([WorldTime.ts:74](src/sun/WorldTime.ts#L74)) und liegt zusätzlich zum gewählten
    Koordinatengitter auf der Karte. Bei 15°-Raster fallen die schwarzen Meridiane des `DegreeGrid`
    daher fast nie mit den roten Stundenlinien zusammen – der Versatz ist die Zeitgleichung plus die
    Tageszeit. Als Canvas-Overlay verschwindet es außerdem während der Zoom-Animation, während die
    `MapGrid`-Linien stehen bleiben.

14. **`index.html` im Root ist generiert** und wird vom Pre-Commit-Hook überschrieben. Änderungen
    dort sind beim nächsten Commit weg – Quelle ist [src/index.html](src/index.html).

---

## Was es nicht gibt

- **Keine Tests** – kein Test-Runner in [package.json](package.json), keine `*.test.ts`.
- **Kein Linter / keine Formatter-Konfiguration**; einzige statische Prüfung ist `tsc --noEmit`
  mit striktem [tsconfig.json](tsconfig.json) (`strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`).
- **Keine Persistenz außer den Markern** – Kartenauswahl, Raster, Home-Marker und Sonnenverlauf sind
  nach einem Reload zurückgesetzt.
- **Kein Undo, kein Umbenennen, kein Verschieben von Markern** (Marker sind nicht `draggable`).
- **Kein Export außer QR/URL** – kein GPX, kein GeoJSON, kein Import aus einer Datei.
- **Keine Rückrichtung beim Grid** – aus einer Bildschirmposition wird nirgends eine Gitterzelle
  bestimmt.
- **Keine Retry-/Timeout-Logik** bei Nominatim, keine Abbruchmöglichkeit laufender Suchen.
- **Keine Attribution der Kartenquellen** im UI, obwohl mehrere Quellen sie fordern.
- **Kein Aufräumen** – kein `destroy()`/`off()` irgendwo; die App lebt so lange wie das Dokument.
