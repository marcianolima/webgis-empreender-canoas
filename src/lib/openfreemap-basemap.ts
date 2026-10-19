import type maplibregl from "maplibre-gl";

/**
 * OpenFreeMap Positron is hosted without API keys.
 * OSM/OpenMapTiles/OpenFreeMap attribution comes from the vector style.
 */
export const OPENFREEMAP_POSITRON = "https://tiles.openfreemap.org/styles/positron";

/** The original basemap is kept separate from the official Canoas layers. */
const basemapLayerIds = new WeakMap<maplibregl.Map, string[]>();

/**
 * Called after the OpenFreeMap style has loaded. The previously existing
 * GeoCanoas/PMTiles layers are added unchanged. Basemap labels are hidden
 * to prevent duplicated neighborhood names with official single-point labels.
 */
export function installCanoasOverlays(
 map: maplibregl.Map,
 overlays: Pick<maplibregl.StyleSpecification, "sources" | "layers">,
): void {
 const original = map.getStyle().layers || [];
 const ids = original.map(layer => layer.id);
 basemapLayerIds.set(map, ids);
 for (const layer of original) {
  if (layer.type === "symbol") map.setLayoutProperty(layer.id, "visibility", "none");
 }
 for (const [id, source] of Object.entries(overlays.sources)) {
  if (map.getSource(id)) throw new Error("Camada cartográfica já registrada: " + id);
  map.addSource(id, source);
 }
 for (const layer of overlays.layers) map.addLayer(layer);
}

/** Existing "Somente bairros oficiais" control still hides only the basemap. */
export function setBasemapVisible(map: maplibregl.Map, visible: boolean): void {
 const ids = basemapLayerIds.get(map) || [];
 for (const id of ids) {
  const layer = map.getLayer(id);
  if (!layer) continue;
  // Always keep external neighborhood labels suppressed.
  const shown = visible && layer.type !== "symbol";
  map.setLayoutProperty(id, "visibility", shown ? "visible" : "none");
 }
}
