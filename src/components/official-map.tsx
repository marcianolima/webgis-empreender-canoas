"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { LngLatBounds, type Map } from "maplibre-gl";
import { ExternalLink, MapPinned } from "lucide-react";
const prefix = process.env.NEXT_PUBLIC_BASE_PATH || "";

function bbox(geometry: unknown, bounds = new LngLatBounds()): LngLatBounds {
  if (!Array.isArray(geometry)) return bounds;
  if (typeof geometry[0] === "number" && typeof geometry[1] === "number") {
    bounds.extend([Number(geometry[0]), Number(geometry[1])]);
  } else geometry.forEach((point) => bbox(point, bounds));
  return bounds;
}

export default function OfficialMap() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  useEffect(() => {
    if (!container.current) return;
    let cancelled = false;
    const map = new maplibregl.Map({
      container: container.current, center: [-51.175, -29.917], zoom: 11, minZoom: 8, maxZoom: 18,
      style: { version: 8, sources: {
        osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256, attribution: "© OpenStreetMap contributors" },
      }, layers: [{ id: "osm", type: "raster", source: "osm" }] },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", async () => {
      try {
        const response = await fetch(prefix + "/data/canoas.geojson", { cache: "no-store" });
        if (!response.ok) throw Error("Malha não publicada");
        const geo = await response.json();
        if (cancelled || !geo.features?.length) throw Error("Malha ausente");
        if (!geo.features.every((f: {properties?: {codarea?: string}}) => f.properties?.codarea === "4304606"))
          throw Error("Malha de outro município");
        map.addSource("ibge-canoas", { type: "geojson", data: geo });
        map.addLayer({ id: "municipality-area", type: "fill", source: "ibge-canoas",
          paint: { "fill-color": "#0c806b", "fill-opacity": 0.14 } });
        map.addLayer({ id: "municipality-border", type: "line", source: "ibge-canoas",
          paint: { "line-color": "#086a58", "line-width": 3 } });
        const bound = new LngLatBounds();
        for (const item of geo.features) bbox(item.geometry.coordinates, bound);
        if (!bound.isEmpty()) map.fitBounds(bound, { padding: 35, maxZoom: 12.8, duration: 0 });
        setStatus("ready");
      } catch { if (!cancelled) setStatus("missing"); }
    });
    return () => { cancelled = true; map.remove(); mapRef.current = null; };
  }, []);
  return <div>
    <div className="relative">
      <div ref={container} className="h-[350px] overflow-hidden rounded-xl bg-slate-100 sm:h-[470px]"
        role="region" aria-label="Mapa real de Canoas com a malha municipal do IBGE quando disponível" />
      <span className="pointer-events-none absolute bottom-8 left-3 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-ink shadow">
        <MapPinned size={14} className="mr-1 inline text-brand-700"/>
        {status === "ready" ? "Limite municipal oficial · IBGE" : status === "loading" ? "Carregando IBGE…" : "Malha do IBGE indisponível"}
      </span>
    </div>
    <p className="mt-3 text-xs leading-relaxed text-slate-500">
      <strong>Sem pontos de empresas:</strong> nenhum endereço foi geocodificado neste projeto. Não são utilizadas coordenadas fictícias.
      {" "}<a href="https://servicodados.ibge.gov.br/api/v3/malhas/municipios/4304606?formato=application/vnd.geo%2Bjson&qualidade=minima"
        target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">
        Geometria oficial IBGE <ExternalLink size={12} className="inline"/>
      </a>
    </p>
  </div>;
}
