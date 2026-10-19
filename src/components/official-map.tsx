"use client";

import {useEffect,useRef,useState} from "react";
import maplibregl,{LngLatBounds,type Map} from "maplibre-gl";
import {PMTiles,Protocol,type Source} from "pmtiles";
import {OPENFREEMAP_POSITRON,installCanoasOverlays} from "@/lib/openfreemap-basemap";
import {ExternalLink,MapPinned} from "lucide-react";

const prefix=process.env.NEXT_PUBLIC_BASE_PATH||"";
const sourceUrl="https://geo.canoas.rs.gov.br/server/rest/services/BAIRROSOFICIAL/FeatureServer/0";
type VerifiedMetadata={
 schemaVersion:number;status:string;territory:string;
 pmtiles?:{path:string;layer:string;bytes:number;geometryCount:number};
};

export default function OfficialMap(){
 const container=useRef<HTMLDivElement>(null);
 const mapRef=useRef<Map|null>(null);
 const [status,setStatus]=useState<"loading"|"ready"|"missing">("loading");

 useEffect(()=>{
  if(!container.current)return;
  let cancelled=false;
  let map:Map|null=null;
  let registered=false;
  const load=async()=>{
   try{
    const metadataResponse=await fetch(prefix+"/data/bairros-economia.json",{cache:"no-store"});
    if(!metadataResponse.ok)throw Error("Metadados dos bairros não encontrados");
    const metadata:VerifiedMetadata=await metadataResponse.json();
    if(metadata.schemaVersion!==1||metadata.status!=="verified"||metadata.territory!=="4304606"
      ||!metadata.pmtiles||metadata.pmtiles.layer!=="bairros"||metadata.pmtiles.geometryCount!==18)
     throw Error("Malha oficial dos bairros não validada");
    const url=window.location.origin+prefix+metadata.pmtiles.path;
    const response=await fetch(url);
    if(!response.ok)throw Error("Arquivo PMTiles indisponível");
    const raw=new Uint8Array(await response.arrayBuffer());
    if(raw.length<127||raw.length>15_000_000||raw[0]!==80||raw[1]!==77||raw[7]!==3)
     throw Error("Arquivo PMTiles inválido");
    if(raw.length!==metadata.pmtiles.bytes)throw Error("Tamanho do PMTiles não corresponde ao catálogo oficial");
    const source:Source={
     getKey:()=>url,
     async getBytes(offset:number,length:number){
      if(offset<0||length<0||offset+length>raw.length)throw Error("Intervalo PMTiles inválido");
      return {data:raw.slice(offset,offset+length).buffer as ArrayBuffer};
     }
    };
    const archive=new PMTiles(source);
    const header=await archive.getHeader();
    if(header.tileType!==1)throw Error("Arquivo não contém tiles vetoriais");
    if(cancelled)return;
    const protocol=new Protocol();
    protocol.add(archive);
    maplibregl.addProtocol("pmtiles",protocol.tile);
    registered=true;
    const overlayStyle:maplibregl.StyleSpecification={version:8,glyphs:"https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      sources:{
       
       bairros:{type:"vector",url:"pmtiles://"+url,attribution:"Bairros oficiais © GeoCanoas · Prefeitura de Canoas"},
       rotulos:{type:"geojson",data:prefix+"/data/bairros-rotulos.geojson"}
      },
      layers:[
       
       {id:"bairros-area",type:"fill",source:"bairros","source-layer":"bairros",
        paint:{"fill-color":"#0c806b","fill-opacity":.16}},
       {id:"bairros-border",type:"line",source:"bairros","source-layer":"bairros",
        paint:{"line-color":"#086a58","line-width":1.6}},
       {id:"bairros-labels",type:"symbol",source:"rotulos",
        layout:{"text-field":["get","bairro"],"text-size":11,"text-font":["Noto Sans Regular"],"text-max-width":10},
        paint:{"text-color":"#173c35","text-halo-color":"#ffffff","text-halo-width":1.3}}
      ]};
    map=new maplibregl.Map({
     container:container.current!,
     center:[-51.175,-29.917],zoom:11,minZoom:8,maxZoom:18,
     style:OPENFREEMAP_POSITRON,
    });
    const current=map;
    mapRef.current=map;
    current.addControl(new maplibregl.NavigationControl({showCompass:false}),"top-right");
    current.on("load",()=>{
     if(cancelled)return;
     installCanoasOverlays(current,overlayStyle);
     const bounds=new LngLatBounds([header.minLon,header.minLat],[header.maxLon,header.maxLat]);
     if(!bounds.isEmpty())current.fitBounds(bounds,{padding:28,maxZoom:12.8,duration:0});
     setStatus("ready");
    });
    current.on("click","bairros-area",e=>{
     const feature=e.features?.[0];
     if(!feature)return;
     const root=document.createElement("div");
     const title=document.createElement("strong");
     title.textContent=String(feature.properties?.bairro||"Bairro de Canoas");
     root.append(title);
     const note=document.createElement("p");note.className="mt-2 text-xs";
     const area=Number(feature.properties?.area_km2);
     note.textContent=Number.isFinite(area)?("Área oficial: "+new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2}).format(area)+" km²"):"Bairro oficial GeoCanoas";
     root.append(note);
     new maplibregl.Popup({maxWidth:"250px"}).setLngLat(e.lngLat).setDOMContent(root).addTo(current);
    });
    current.on("mouseenter","bairros-area",()=>{current.getCanvas().style.cursor="pointer";});
    current.on("mouseleave","bairros-area",()=>{current.getCanvas().style.cursor="";});
    current.on("error",e=>{
     if(!cancelled&&/pmtiles|source-layer|bairros/i.test(String(e.error?.message||"")))setStatus("missing");
    });
   }catch{
    if(!cancelled)setStatus("missing");
   }
  };
  void load();
  return ()=>{
   cancelled=true;
   map?.remove();
   if(registered)maplibregl.removeProtocol("pmtiles");
   mapRef.current=null;
  };
 },[]);

 return <div>
  <div className="relative">
   <div ref={container} className="h-[350px] overflow-hidden rounded-xl bg-slate-100 sm:h-[470px]"
    role="region" aria-label="Mapa interativo dos 18 bairros oficiais de Canoas usando PMTiles GeoCanoas"/>
   <span className="pointer-events-none absolute bottom-8 left-3 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-ink shadow">
    <MapPinned size={14} className="mr-1 inline text-brand-700"/>
    {status==="ready"?"18 bairros oficiais · GeoCanoas / PMTiles":status==="loading"?"Carregando bairros oficiais…":"Mapa dos bairros indisponível"}
   </span>
  </div>
  <p className="mt-3 text-xs leading-relaxed text-slate-500">
   <strong>Geometria oficial dos bairros:</strong> camada BAIRROSOFICIAL GeoCanoas, publicada em PMTiles vetorial. Os polígonos não representam pontos de localização individual de empresas.
   {" "}<a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">
    Serviço cartográfico GeoCanoas <ExternalLink size={12} className="inline"/>
   </a>
  </p>
 </div>;
}
