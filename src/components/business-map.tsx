"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type Map, type GeoJSONSource } from "maplibre-gl";
import type { Business, MapMode } from "@/types/establishment";

type Props = { businesses: Business[]; mode: MapMode };

function toGeoJSON(rows: Business[]) {
  return {
    type: "FeatureCollection" as const,
    features: rows.map((row) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [row.longitude, row.latitude] },
      properties: {
        id: row.id,
        nome: row.nome,
        bairro: row.bairro,
        cnae: row.cnae,
        inicio: row.inicio,
        status: row.status === "02" ? "Ativo (simulado)" : "Baixado (simulado)",
      },
    })),
  };
}

export default function BusinessMap({ businesses, mode }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const rowsRef = useRef(businesses);
  const modeRef = useRef(mode);
  rowsRef.current = businesses;
  modeRef.current = mode;

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      center: [-51.1765, -29.918],
      zoom: 11.2,
      minZoom: 9,
      maxZoom: 18,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      map.addSource("businesses", {
        type: "geojson",
        data: toGeoJSON(rowsRef.current),
        cluster: true,
        clusterRadius: 46,
        clusterMaxZoom: 14,
      });
      map.addLayer({
        id: "heatmap",
        type: "heatmap",
        source: "businesses",
        maxzoom: 15,
        layout: { visibility: modeRef.current === "heatmap" ? "visible" : "none" },
        paint: {
          "heatmap-weight": 1,
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 0.7, 15, 2],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 18, 15, 36],
          "heatmap-opacity": 0.65,
        },
      });
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "businesses",
        filter: ["has", "point_count"],
        layout: { visibility: modeRef.current === "points" ? "visible" : "none" },
        paint: {
          "circle-color": "#087f66",
          "circle-radius": ["step", ["get", "point_count"], 17, 10, 22, 40, 27],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "businesses",
        filter: ["has", "point_count"],
        layout: {
          "visibility": modeRef.current === "points" ? "visible" : "none",
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
          "text-size": 12,
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: "business-points",
        type: "circle",
        source: "businesses",
        filter: ["!", ["has", "point_count"]],
        layout: { visibility: modeRef.current === "points" ? "visible" : "none" },
        paint: {
          "circle-color": "#ffad55",
          "circle-radius": 6,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });
      map.on("click", "business-points", (event) => {
        const features = map.queryRenderedFeatures(event.point, { layers: ["business-points"] });
        if (!features.length) return;
        const props = features[0].properties as Record<string, string>;
        const root = document.createElement("div");
        root.className = "text-sm";
        const title = document.createElement("strong");
        title.textContent = props.nome ?? "Registro demonstrativo";
        title.className = "block text-sm";
        root.append(title);
        for (const [label, value] of [
          ["Código", props.id], ["Bairro declarado", props.bairro],
          ["CNAE ilustrativa", props.cnae], ["Abertura", props.inicio],
          ["Situação", props.status],
        ]) {
          const line = document.createElement("p");
          line.className = "mt-1 text-xs";
          line.textContent = label + ": " + (value ?? "—");
          root.append(line);
        }
        const note = document.createElement("p");
        note.className = "mt-2 text-xs font-semibold text-amber-800";
        note.textContent = "DADO FICTÍCIO — localização sintética, não representa empresa real.";
        root.append(note);
        const coordinates = (features[0].geometry as { coordinates?: number[] }).coordinates;
        if (coordinates) new maplibregl.Popup({ closeButton: true, maxWidth: "300px" })
          .setLngLat([coordinates[0], coordinates[1]])
          .setDOMContent(root).addTo(map);
      });
      map.on("click", "clusters", async (event) => {
        const features = map.queryRenderedFeatures(event.point, { layers: ["clusters"] });
        if (!features.length) return;
        const clusterId = Number(features[0].properties?.cluster_id);
        const coordinates = (features[0].geometry as { coordinates?: number[] }).coordinates;
        const source = map.getSource("businesses") as GeoJSONSource | undefined;
        if (!source || !coordinates || !Number.isFinite(clusterId)) return;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        map.easeTo({ center: [coordinates[0], coordinates[1]], zoom });
      });
      for (const layer of ["business-points", "clusters"]) {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
      }
    });
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !map.getSource("businesses")) return;
    (map.getSource("businesses") as GeoJSONSource).setData(toGeoJSON(businesses));
  }, [businesses]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !map.getLayer("clusters")) return;
    ["clusters", "cluster-count", "business-points"].forEach((layer) => {
      map.setLayoutProperty(layer, "visibility", mode === "points" ? "visible" : "none");
    });
    map.setLayoutProperty("heatmap", "visibility", mode === "heatmap" ? "visible" : "none");
  }, [mode]);

  return (
    <div className="relative">
      <div ref={container} role="region" aria-label="Mapa de localização ilustrativa de estabelecimentos fictícios em Canoas"
        className="h-[340px] w-full overflow-hidden rounded-xl bg-slate-100 sm:h-[440px] lg:h-[500px]" />
      <div className="pointer-events-none absolute bottom-8 left-3 max-w-52 rounded-lg bg-white/95 px-3 py-2 text-[11px] font-semibold text-amber-900 shadow">
        Pontos demonstrativos — sem geocodificação real
      </div>
    </div>
  );
}
