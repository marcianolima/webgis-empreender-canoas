"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import maplibregl,{LngLatBounds,type ExpressionSpecification,type FilterSpecification} from "maplibre-gl";
import {PMTiles,Protocol,type Source} from "pmtiles";
import {
 Activity,BarChart3,Download,ExternalLink,FileCheck2,Hexagon,Layers3,
 MapPinned,Search,ShieldCheck,TrendingUp
} from "lucide-react";
import {ResponsiveContainer,ScatterChart,Scatter,XAxis,YAxis,CartesianGrid,Tooltip,BarChart,Bar} from "recharts";
import {OPENFREEMAP_POSITRON,installCanoasOverlays,setBasemapVisible} from "@/lib/openfreemap-basemap";

const base=process.env.NEXT_PUBLIC_BASE_PATH||"";
const green=["#edf5f1","#c7e6d7","#8bceb2","#3f9f7b","#12664c"];
const NODATA="#dbe3ea";
const integer=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:0});
const decimal=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2});
const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});
type Dictionary={id:string;code:string;group:string;label:string;unit:string;description:string;sectorsWithData:number;precision:number};
type Sector={id:string;bairroIbge:string;situacao:string;centroid:number[];metrics:Record<string,number|null>};
type Census={
 schemaVersion:1;status:"verified";territory:string;referenceYear:2022;sectorCount:number;populationSumReported:number;
 generatedAt:string;sourceGeometry:string;sourceAggregates:Record<string,string>;dictionary:Dictionary[];
 pmtiles:{path:string;bytes:number;sha256:string;layers:string[];sourceGeometryPath:string};
 coverage:{sectorsWithPopulation:number;sectorsWithIncome:number;metricsWithData:number};
 privacy:{individualCoordinatesPublished:boolean;withheldValuesKeptNull:boolean};
 sectors:Sector[];
};
type OverlapLink={name:string;areaSharePct:number};
type Overlap={
 id:string;officialBairroDominant:string|null;dominantAreaPercent:number;
 bairrosIntersected:OverlapLink[];crossBoundary:boolean;
};
type District={bairro:string;fullyContained:number;crossBoundary:number;fullyContainedPop:number;
 populationArealEstimate:number;populationAreaAllocationUnknown:number;sectorCount:number;areaKm2:number};
type Topology={schemaVersion:1;status:"verified";territory:string;modelled:boolean;
 sectors:Overlap[];neighborhoods:District[]};
type DistrictBusiness={reference:string;neighborhoods:{name:string;active:number|null;areaKm2:number;population2022:number|null}[]};
type HexContext={spatialTopology?:{neighborhoods:{bairro:string;observedAddresses:number|null;observedPerKm2:number|null}[]}};
type OfficialPolygon={type:"FeatureCollection";features:Array<{properties:{BAIRRO:string};geometry:GeoJSON.Polygon|GeoJSON.MultiPolygon}>};
type FocusState={sectors:Sector[];byId:Map<string,Sector>;dictionary:Map<string,Dictionary>};
const format=(v:number|null|undefined,metadata?:Dictionary):string=>{
 if(v===null||v===undefined||!Number.isFinite(v))return "N/D";
 if(metadata?.unit.startsWith("R$"))return money.format(v);
 return (metadata?.precision===0?integer:decimal).format(v)+(metadata?.unit==="%"?"%":"");
};
function quantiles(values:number[]):number[]{
 const sorted=values.filter(Number.isFinite).slice().sort((a,b)=>a-b);
 if(!sorted.length)return [];
 return [...new Set([.2,.4,.6,.8].map(q=>sorted[Math.floor((sorted.length-1)*q)]))]
  .filter(x=>x>sorted[0]);
}
function color(steps:number[]):ExpressionSpecification{
 const field=["number",["get","__metric__"],-1]; // substitute metric in calling function
 const items:unknown[]=["step",field,green[0]];
 steps.forEach((v,i)=>items.push(v,green[Math.min(i+1,4)]));
 return ["case",["==",field,-1],NODATA,items] as ExpressionSpecification;
}
function metricColor(metric:string,steps:number[]):ExpressionSpecification{
 const expr=color(steps);
 // Expression authored as literal property lookup; never interpolate JS into style JSON strings.
 const mapNodes=(node:unknown):unknown=>{
  if(Array.isArray(node))return node.map(mapNodes);
  return node==="__metric__"?metric:node;
 };
 return mapNodes(expr) as ExpressionSpecification;
}
function csvExport(rows:Sector[],metric:Dictionary,topology:Map<string,Overlap>,populationRef:string){
 const headers=["codigo_setor_ibge","municipio_ibge","ano_censo","bairro_ibge","bairros_oficiais_intersectados",
  "maior_area_em_bairro_pct","setor_cruza_divisa","populacao_2022","area_km2","indicador","unidade","valor"];
 const entries=rows.map(s=>{const o=topology.get(s.id);
  return [s.id,"4304606","2022",s.bairroIbge,
    o?.bairrosIntersected.map(b=>b.name).join(" / ")||"",
    o?.dominantAreaPercent??"",o?.crossBoundary?"sim":"não",
    s.metrics.pop??"",s.metrics.area_km2??"",metric.label,metric.unit,s.metrics[metric.id]??""];});
 const safe=(v:unknown)=>'"'+(String(v??"").match(/^[=+@]/)?"'":"")+String(v??"").replaceAll('"','""')+'"';
 const csv="\ufeff"+[headers,...entries].map(r=>r.map(safe).join(";")).join("\r\n");
 const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
 const a=document.createElement("a");a.href=url;a.download="censo2022-setores-canoas-"+metric.id+"-"+populationRef+".csv";
 a.click();URL.revokeObjectURL(url);
}
function append(root:HTMLElement,name:string,value:string){
 const line=document.createElement("p");line.className="py-1";
 const strong=document.createElement("strong");strong.textContent=name+": ";
 line.append(strong,document.createTextNode(value));root.append(line);
}
const groupNames:Record<string,string>={
 indicadores:"Indicadores derivados",basico:"População e domicílios · 2022",
 demografia:"Demografia · 2022",domicilio:"Características habitacionais · 2022",
 renda:"Rendimento do responsável · 2022"
};
export function Censo2022SetoresDashboard(){
 const element=useRef<HTMLDivElement|null>(null);
 const mapRef=useRef<maplibregl.Map|null>(null);
 const stateRef=useRef<FocusState|null>(null);
 const [census,setCensus]=useState<Census|null>(null);
 const [topology,setTopology]=useState<Topology|null>(null);
 const [business,setBusiness]=useState<DistrictBusiness|null>(null);
 const [hex,setHex]=useState<HexContext|null>(null);
 const [official,setOfficial]=useState<OfficialPolygon|null>(null);
 const [error,setError]=useState("");
 const [mapError,setMapError]=useState("");
 const [ready,setReady]=useState(false);
 const [metric,setMetric]=useState("dens_pop");
 const [compareMetric,setCompareMetric]=useState("renda_mediana");
 const [bairro,setBairro]=useState("all");
 const [situacao,setSituacao]=useState("all");
 const [search,setSearch]=useState("");
 const [selected,setSelected]=useState("");
 const [basemap,setBasemap]=useState(true);
 const [rankLimit,setRankLimit]=useState(20);
 useEffect(()=>{
  const ctrl=new AbortController();
  async function json(path:string){
   const response=await fetch(base+"/data/"+path,{signal:ctrl.signal,cache:"no-store"});
   if(!response.ok)throw Error(path+" HTTP "+response.status);
   return response.json();
  }
  Promise.all([
   json("censo2022-setores.json"),json("censo2022-setores-bairros.json"),
   json("bairros-economia.json"),json("cnefe-hex500.json"),
   json("bairros-oficiais.geojson")
  ]).then(([c,t,b,h,o]:[Census,Topology,DistrictBusiness,HexContext,OfficialPolygon])=>{
   if(c.status!=="verified"||t.status!=="verified"||c.territory!=="4304606"||
     c.sectorCount!==c.sectors.length||t.sectors.length!==c.sectors.length||
     c.referenceYear!==2022||t.neighborhoods.length!==18||o.features.length!==18||
     c.privacy.individualCoordinatesPublished)throw Error("Arquivos censitários municipais não homologados");
   if(!c.dictionary.some(x=>x.id==="pop")||!c.dictionary.some(x=>x.id==="dens_pop"))throw Error("Metadados censitários incompletos");
   setCensus(c);setTopology(t);setBusiness(b);setHex(h);setOfficial(o);
  }).catch(e=>{if(e.name!=="AbortError")setError(String(e.message||e));});
  return ()=>ctrl.abort();
 },[]);
 const dictionary=useMemo(()=>new Map(census?.dictionary.map(d=>[d.id,d])||[]),[census]);
 const links=useMemo(()=>new Map(topology?.sectors.map(link=>[link.id,link])||[]),[topology]);
 const bairros=useMemo(()=>topology?.neighborhoods.slice().sort((a,b)=>a.bairro.localeCompare(b.bairro,"pt-BR"))||[],[topology]);
 const filtered=useMemo(()=>census?.sectors.filter(s=>
  (situacao==="all"||(situacao==="urban"&&s.situacao.toLocaleLowerCase("pt-BR").includes("urbana"))||
   (situacao==="rural"&&!s.situacao.toLocaleLowerCase("pt-BR").includes("urbana"))) &&
  (bairro==="all"||links.get(s.id)?.bairrosIntersected.some(l=>l.name===bairro))
 )||[],[census,situacao,bairro,links]);
 const byId=useMemo(()=>new Map(census?.sectors.map(s=>[s.id,s])||[]),[census]);
 const currentMeta=dictionary.get(metric);
 const comparisonMeta=dictionary.get(compareMetric);
 const valid=useMemo(()=>filtered.filter(s=>typeof s.metrics[metric]==="number"),[filtered,metric]);
 const steps=useMemo(()=>quantiles(valid.map(s=>s.metrics[metric] as number)),[valid,metric]);
 const rank=useMemo(()=>filtered
  .filter(s=>s.id.includes(search.trim())||s.bairroIbge.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")))
  .filter(s=>typeof s.metrics[metric]==="number")
  .sort((a,b)=>(b.metrics[metric] as number)-(a.metrics[metric] as number)),[filtered,search,metric]);
 const focus=byId.get(selected);
 const district=topology?.neighborhoods.find(n=>n.bairro===bairro);
 const businessRow=business?.neighborhoods.find(x=>x.name===bairro);
 const observed=hex?.spatialTopology?.neighborhoods.find(x=>x.bairro===bairro);
 const visibleIds=useMemo(()=>filtered.map(x=>x.id),[filtered]);
 const populationFull=bairro==="all"?
  census?.populationSumReported??null:district?.fullyContainedPop??null;
 const sectorCoverage=filtered.filter(s=>s.metrics.pop!==null&&s.metrics.pop!==undefined).length;
 const selectedData=useMemo(()=>filtered.map(s=>({id:s.id,x:s.metrics[compareMetric],
  y:s.metrics[metric]})).filter(v=>typeof v.x==="number"&&typeof v.y==="number"),[filtered,compareMetric,metric]);
 const histogram=useMemo(()=>{
  if(!valid.length)return [];
  const minimum=Math.min(...valid.map(s=>s.metrics[metric] as number));
  const maximum=Math.max(...valid.map(s=>s.metrics[metric] as number));
  const width=maximum>minimum?(maximum-minimum)/8:1;
  const buckets=Array.from({length:8},(_,i)=>({label:decimal.format(minimum+i*width),value:0}));
  for(const s of valid){
   const index=Math.min(7,Math.floor(((s.metrics[metric] as number)-minimum)/width));
   buckets[index].value++;
  }
  return buckets;
 },[valid,metric]);
 stateRef.current={sectors:filtered,byId,dictionary};

 useEffect(()=>{
  if(!census?.pmtiles||!element.current||!official||!topology)return;
  let disposed=false,registered=false,map:maplibregl.Map|null=null;
  setReady(false);setMapError("");
  (async()=>{
   const url=window.location.origin+base+census.pmtiles.path;
   const resp=await fetch(url,{cache:"no-store"});
   if(!resp.ok)throw Error("Arquivo PMTiles HTTP "+resp.status);
   const bytes=new Uint8Array(await resp.arrayBuffer());
   if(bytes.length!==census.pmtiles.bytes||bytes.length<130||bytes.length>36_000_000||
    bytes[0]!==80||bytes[1]!==77||bytes[7]!==3)throw Error("PMTiles setores 2022 inválido");
   const source:Source={getKey:()=>url,async getBytes(offset:number,length:number){
    if(offset<0||length<0||offset+length>bytes.length)throw Error("Leitura PMTiles fora do arquivo");
    return {data:bytes.slice(offset,offset+length).buffer as ArrayBuffer};
   }};
   const archive=new PMTiles(source);
   const header=await archive.getHeader();
   if(header.tileType!==1)throw Error("PMTiles não contém polígonos vetoriais");
   if(disposed)return;
   const protocol=new Protocol();protocol.add(archive);
   maplibregl.addProtocol("pmtiles",protocol.tile);registered=true;
   const overlays:maplibregl.StyleSpecification={version:8,
    sources:{
     setores:{type:"vector",url:"pmtiles://"+url,attribution:"© IBGE · Censo 2022"},
     bairros:{type:"geojson",data:base+"/data/bairros-oficiais.geojson"},
     rotulos:{type:"geojson",data:base+"/data/bairros-rotulos.geojson"}
    },layers:[
     {id:"censo-fill",type:"fill",source:"setores","source-layer":"setores",
      paint:{"fill-color":green[1],"fill-opacity":.79}},
     {id:"censo-border",type:"line",source:"setores","source-layer":"setores",
      paint:{"line-color":"#47615b","line-width":.42,"line-opacity":.8}},
     {id:"censo-select",type:"line",source:"setores","source-layer":"setores",
      filter:["==",["get","id"],""],paint:{"line-color":"#c86c20","line-width":3}},
     {id:"bairros-outline",type:"line",source:"bairros",
      paint:{"line-color":"#153f36","line-width":2}},
     {id:"bairros-select",type:"line",source:"bairros",
      filter:["==",["get","BAIRRO"],""],paint:{"line-color":"#d17b23","line-width":3}},
     {id:"bairros-label",type:"symbol",source:"rotulos",
      layout:{"text-field":["get","bairro"],"text-font":["Noto Sans Regular"],"text-size":10.5,"text-max-width":12},
      paint:{"text-color":"#173e35","text-halo-color":"#fff","text-halo-width":1.25}}
    ]};
   map=new maplibregl.Map({container:element.current!,center:[-51.19,-29.915],
    zoom:11,minZoom:9,maxZoom:17,style:OPENFREEMAP_POSITRON});
   mapRef.current=map;
   const current=map;
   current.addControl(new maplibregl.NavigationControl({showCompass:false}),"top-right");
   current.on("load",()=>{
    if(disposed)return;
    installCanoasOverlays(current,overlays);
    const bounds=new LngLatBounds([header.minLon,header.minLat],[header.maxLon,header.maxLat]);
    if(!bounds.isEmpty())current.fitBounds(bounds,{padding:25,duration:0,maxZoom:13});
    setReady(true);
   });
   current.on("click","censo-fill",e=>{
    const id=String(e.features?.[0]?.properties?.id||"");
    const state=stateRef.current;
    const row=state?.byId.get(id);
    if(!row)return;
    setSelected(id);
    const root=document.createElement("div"),h=document.createElement("strong");
    h.textContent="Setor censitário "+id;root.append(h);
    append(root,"Situação",row.situacao);
    const metricInfo=state?.dictionary.get(metric);
    append(root,"Indicador",metricInfo?.label||metric);
    append(root,"Valor",format(row.metrics[metric],metricInfo));
    append(root,"População 2022",format(row.metrics.pop));
    append(root,"Domicílios ocupados",format(row.metrics.dom_ocupados));
    const overlap=links.get(id);
    if(overlap)append(root,"Bairros intersectados",overlap.bairrosIntersected.map(x=>x.name).join(" · ")||"Nenhum");
    new maplibregl.Popup({maxWidth:"325px"}).setLngLat(e.lngLat).setDOMContent(root).addTo(current);
   });
   current.on("mouseenter","censo-fill",()=>{current.getCanvas().style.cursor="pointer";});
   current.on("mouseleave","censo-fill",()=>{current.getCanvas().style.cursor="";});
   current.on("error",e=>{
    const message=String(e.error?.message||"");
    if(!disposed&&/pmtiles|setor|vector tile|source-layer/i.test(message))setMapError(message);
   });
  })().catch(e=>{if(!disposed)setMapError(String(e));});
  return ()=>{disposed=true;map?.remove();if(registered)maplibregl.removeProtocol("pmtiles");mapRef.current=null;};
 },[census,official,topology,links,metric]);

 useEffect(()=>{
  const map=mapRef.current;if(!map||!ready)return;
  map.setPaintProperty("censo-fill","fill-color",metricColor(metric,steps));
  const filter:FilterSpecification=["in",["get","id"],["literal",visibleIds]];
  for(const layer of ["censo-fill","censo-border"])map.setFilter(layer,filter);
  map.setFilter("censo-select",["==",["get","id"],selected]);
  map.setFilter("bairros-select",["==",["get","BAIRRO"],bairro==="all"?"":bairro]);
 },[metric,steps,visibleIds,selected,ready,bairro]);
 useEffect(()=>{
  const map=mapRef.current;if(map&&ready)setBasemapVisible(map,basemap);
 },[basemap,ready]);
 const select=(sector:Sector)=>{
  setSelected(sector.id);
  mapRef.current?.flyTo({center:[sector.centroid[0],sector.centroid[1]],zoom:14,speed:1.2});
 };
 const grouped=useMemo(()=>{
  const groups=new Map<string,Dictionary[]>();
  for(const d of census?.dictionary||[]){
   if(!groups.has(d.group))groups.set(d.group,[]);
   groups.get(d.group)!.push(d);
  }
  return groups;
 },[census]);

 return <main className="mx-auto max-w-[1500px] space-y-5 px-4 pb-16 pt-8 text-ink sm:px-6">
  <header className="flex flex-wrap items-start justify-between gap-4">
   <div className="max-w-4xl">
    <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">
     <MapPinned size={15}/> Censo 2022 · Setores IBGE · PMTiles
    </span>
    <h1 className="mt-3 text-2xl font-extrabold sm:text-4xl">Atlas dos setores censitários de Canoas</h1>
    <p className="mt-2 text-sm leading-relaxed text-slate-600">
     Malha oficial do IBGE de 2022 com indicadores territoriais de população, domicílios, demografia
     e rendimento. Integração geométrica com os bairros oficiais GeoCanoas e contextualização econômica
     do WebGIS, sem atribuição fictícia de CNPJs a setores.
    </p>
   </div>
   {currentMeta&&filtered.length>0&&<button type="button"
    onClick={()=>csvExport(filtered,currentMeta,links,"2022")}
    className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white">
    <Download size={15}/> Exportar setores CSV</button>}
  </header>
  {error&&<div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
   Camada censitária não validada: {error}. A malha precisa ser gerada pelo pipeline oficial do projeto.
  </div>}
  {!census&&!error&&<p className="rounded-xl bg-white p-5 text-sm text-slate-600">Carregando malha e agregados censitários locais…</p>}
  {census&&topology&&<>
   <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {[
     ["Setores visíveis",integer.format(filtered.length),"de "+integer.format(census.sectorCount)+" setores oficiais"],
     [bairro==="all"?"População censitária": "População em setores inteiros",
      format(populationFull),bairro==="all"?"Censo 2022 · soma por setor":"Limite inferior; sem rateio de setores de divisa"],
     ["Setores com população",integer.format(sectorCoverage),"Valor oficial disponível no recorte"],
     ["Variáveis disponíveis",integer.format(census.dictionary.length),"Com descrições oficiais IBGE"]
    ].map(([label,value,note])=><article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
     <p className="text-xs font-bold uppercase leading-relaxed text-slate-500">{label}</p>
     <p className="mt-2 break-words text-2xl font-extrabold tabular-nums">{value}</p>
     <p className="mt-2 text-xs leading-relaxed text-slate-500">{note}</p>
    </article>)}
   </section>
   <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
    <label className="min-w-0 text-xs font-bold text-slate-600">Indicador temático
     <select aria-label="Indicador censitário" value={metric}
      onChange={e=>{setMetric(e.target.value);setSelected("");setRankLimit(20);}}
      className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal">
      {Array.from(grouped).map(([key,list])=><optgroup key={key} label={groupNames[key]||key}>
       {list.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}
      </optgroup>)}
     </select>
    </label>
    <label className="min-w-0 text-xs font-bold text-slate-600">Bairro oficial GeoCanoas
     <select aria-label="Filtrar setor por bairro oficial" value={bairro}
      onChange={e=>{setBairro(e.target.value);setSelected("");setRankLimit(20);}}
      className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal">
      <option value="all">Todos os 18 bairros</option>
      {bairros.map(r=><option value={r.bairro} key={r.bairro}>{r.bairro}</option>)}
     </select>
    </label>
    <label className="min-w-0 text-xs font-bold text-slate-600">Situação do setor
     <select aria-label="Filtrar situação do setor" value={situacao} onChange={e=>setSituacao(e.target.value)}
      className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal">
      <option value="all">Todos os setores</option><option value="urban">Urbanos</option><option value="rural">Não urbanos</option>
     </select>
    </label>
    <label className="min-w-0 text-xs font-bold text-slate-600">Mapa-base
     <select value={basemap?"with":"clean"} onChange={e=>setBasemap(e.target.value==="with")}
      className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal">
      <option value="with">OpenStreetMap sem API key</option><option value="clean">Somente camadas oficiais</option>
     </select>
    </label>
   </section>
   <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-card sm:p-4">
     <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-sm font-bold"><Layers3 size={17}/> {currentMeta?.label}</h2>
       <p className="mt-1 text-xs leading-relaxed text-slate-500">{currentMeta?.description}</p></div>
      <span className="text-xs text-slate-500">{integer.format(valid.length)} setores com dado</span>
     </div>
     <div className="relative">
      <div ref={element} role="region" aria-label="Mapa censitário oficial PMTiles 2022 de Canoas"
       className="h-[405px] overflow-hidden rounded-xl bg-slate-100 sm:h-[570px]"/>
      {!ready&&!mapError&&<div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/80 p-4 text-sm font-semibold text-slate-600">Carregando PMTiles dos setores censitários…</div>}
      {mapError&&<div role="alert" className="absolute inset-0 flex items-center justify-center bg-white/95 p-5 text-sm text-amber-900">Mapa censitário indisponível: {mapError}</div>}
     </div>
     <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
      <span className="h-3 w-4 rounded bg-slate-200"/> Sem informação
      {green.slice(0,steps.length+1).map((clr,i)=><span key={clr} className="inline-flex items-center gap-1.5">
       <span className="h-3 w-5 rounded" style={{background:clr}}/>
       {i===0?"Menor":i===steps.length?"Maior":""}
      </span>)}
      <span className="ml-auto">{currentMeta?.unit}</span>
     </div>
     <p className="mt-3 text-xs leading-relaxed text-slate-500">
      Cores por quantis entre setores visíveis, sem inferir dados ocultados pelo IBGE.
      Limites de bairros em destaque são oficiais GeoCanoas; setores que atravessam suas divisas aparecem
      nas consultas de todos os bairros que interceptam, sem duplicação de população.
     </p>
    </article>
    <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
     <h2 className="flex items-center gap-2 text-base font-bold"><Search size={17}/> Ranking de setores</h2>
     <p className="mt-1 text-xs leading-relaxed text-slate-500">Ordenado por {currentMeta?.label?.toLowerCase()}. Clique para aproximar.</p>
     <label className="mt-3 block text-xs font-semibold text-slate-600">
      <input aria-label="Buscar código de setor" value={search} onChange={e=>{setSearch(e.target.value);setRankLimit(20);}}
       placeholder="Código do setor ou bairro"
       className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"/>
     </label>
     <div className="mt-3 max-h-[480px] space-y-1.5 overflow-y-auto">
      {rank.slice(0,rankLimit).map((s,i)=><button type="button" key={s.id} onClick={()=>select(s)}
       className={"flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left "+
        (selected===s.id?"border-brand-600 bg-brand-50":"border-slate-100 bg-slate-50 hover:border-brand-200")}>
       <span className="min-w-0">
        <span className="block break-all text-[11px] font-bold">{i+1}. {s.id}</span>
        <span className="mt-1 block truncate text-[10px] text-slate-500">{s.bairroIbge||s.situacao}</span>
       </span>
       <strong className="shrink-0 text-xs tabular-nums">{format(s.metrics[metric],currentMeta)}</strong>
      </button>)}
      {rank.length>rankLimit&&<button type="button" onClick={()=>setRankLimit(x=>x+30)}
       className="w-full rounded-lg bg-brand-50 p-2.5 text-xs font-bold text-brand-700">
       Mostrar mais setores ({integer.format(rank.length-rankLimit)} restantes)</button>}
     </div>
     {focus&&<div className="mt-3 space-y-1 rounded-xl border border-brand-100 bg-brand-50 p-3 text-xs">
      <strong>Setor {focus.id}</strong>
      <p>População: {format(focus.metrics.pop)} · Área: {format(focus.metrics.area_km2)} km²</p>
      <p>Moradores por domicílio: {format(focus.metrics.moradores_media)}</p>
      <p>Renda mediana do responsável: {format(focus.metrics.renda_mediana,dictionary.get("renda_mediana"))}</p>
      <p>Bairros oficiais com interseção: {links.get(focus.id)?.bairrosIntersected.map(x=>x.name).join(", ")||"N/D"}</p>
      {links.get(focus.id)?.crossBoundary&&<p className="font-semibold text-amber-800">Setor cruza limite de bairro — não há transferência automática de residentes.</p>}
     </div>}
    </aside>
   </section>
   <section className="grid gap-4 lg:grid-cols-2">
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
     <div className="flex items-center gap-2"><BarChart3 size={18} className="text-brand-700"/><h2 className="text-sm font-bold">Distribuição entre setores</h2></div>
     <p className="mt-1 text-xs text-slate-500">Frequência por faixa de {currentMeta?.label?.toLowerCase()}, somente entre setores com valor.</p>
     <div role="img" aria-label="Histograma de frequência setorial por classe do indicador selecionado" className="mt-3 h-[245px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
       <BarChart data={histogram} margin={{top:8,right:6,bottom:10,left:0}}>
        <CartesianGrid vertical={false} stroke="#e5e7eb"/>
        <XAxis dataKey="label" interval={1} tick={{fontSize:10}}/>
        <YAxis allowDecimals={false} width={35} tick={{fontSize:11}}/>
        <Tooltip formatter={(n)=>integer.format(Number(n))}/>
        <Bar dataKey="value" name="Setores" fill="#167d5c" radius={[3,3,0,0]}/>
       </BarChart>
      </ResponsiveContainer>
     </div>
    </article>
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
     <div className="flex items-center gap-2"><TrendingUp size={18} className="text-brand-700"/><h2 className="text-sm font-bold">Exploração multivariada</h2></div>
     <p className="mt-1 text-xs text-slate-500">Cada ponto representa um setor com as duas variáveis publicadas. Não implica relação causal.</p>
     <label className="mt-3 block text-xs font-semibold text-slate-600">Eixo horizontal
      <select aria-label="Comparar variável censitária" value={compareMetric}
       onChange={e=>setCompareMetric(e.target.value)}
       className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 p-2.5 text-xs font-normal">
       {Array.from(grouped).map(([group,list])=><optgroup key={group} label={groupNames[group]||group}>
        {list.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}
       </optgroup>)}
      </select>
     </label>
     <div className="mt-3 h-[245px] w-full min-w-0" role="img" aria-label="Dispersão de dois indicadores por setor censitário">
      <ResponsiveContainer width="100%" height="100%">
       <ScatterChart margin={{top:10,right:10,bottom:10,left:0}}>
        <CartesianGrid stroke="#edf0f2"/>
        <XAxis type="number" dataKey="x" name={comparisonMeta?.label||compareMetric} tick={{fontSize:10}}/>
        <YAxis type="number" dataKey="y" name={currentMeta?.label||metric} tick={{fontSize:10}} width={45}/>
        <Tooltip cursor={{strokeDasharray:"3 3"}} formatter={(v)=>decimal.format(Number(v))}/>
        <Scatter data={selectedData} name="Setores" fill="#12805e" opacity={.66}/>
       </ScatterChart>
      </ResponsiveContainer>
     </div>
     <p className="text-xs text-slate-500">{integer.format(selectedData.length)} setores com valores válidos para ambas as variáveis.</p>
    </article>
   </section>
   <section className="grid gap-4 lg:grid-cols-2">
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
     <h2 className="flex items-center gap-2 text-sm font-bold"><Hexagon size={17}/> Integração com bairros e economia</h2>
     {bairro==="all"?<p className="mt-2 text-xs leading-relaxed text-slate-600">
      Selecione um bairro oficial para consultar os setores que o interceptam, a quantidade de setores inteiramente
      contidos e o contexto das bases de CNPJ e CNEFE. Nenhum CNPJ é deslocado para o setor censitário.
     </p>:<div className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">
      <p className="font-bold text-ink">{bairro}</p>
      <p>Setores interceptados: <strong>{integer.format(district?.sectorCount||0)}</strong> · completamente contidos: <strong>{integer.format(district?.fullyContained||0)}</strong> · de divisa: <strong>{integer.format(district?.crossBoundary||0)}</strong>.</p>
      <p>População de setores inteiramente contidos: <strong>{format(district?.fullyContainedPop)}</strong>. É um subtotal, não a população integral do bairro.</p>
      <p>Projeção de habitantes por área interpolada: <strong>≈ {format(district?.populationArealEstimate)}</strong>. <strong>Estimativa modelada</strong>, não resultado setorial IBGE observado nem total oficial por bairro.</p>
      <p>População indicada no bairro GeoCanoas 2022: <strong>{format(businessRow?.population2022)}</strong>. Os perímetros e procedimentos podem divergir.</p>
      <p>CNPJs ativos por bairro declarado (RFB {business?.reference}): <strong>{format(businessRow?.active)}</strong>.</p>
      <p>Endereços CNEFE não residenciais observados em 2022: <strong>{format(observed?.observedAddresses)}</strong>.</p>
     </div>}
     <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold text-brand-700">
      <a href={base+"/bairros/"} className="underline">Mapa econômico</a>
      <a href={base+"/hex500/"} className="underline">Grade hexagonal CNEFE</a>
      <a href={base+"/territorio/"} className="underline">Mapa bivariado CNPJ × CNEFE</a>
     </div>
    </article>
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
     <h2 className="flex items-center gap-2 text-sm font-bold"><FileCheck2 size={17}/> Qualidade e proveniência</h2>
     <p className="mt-2 text-xs leading-relaxed text-slate-600">
      {integer.format(census.sectorCount)} setores da malha 2022, recortados do estado do RS por código municipal.
      {integer.format(census.coverage.sectorsWithPopulation)} com população publicável;
      {integer.format(census.coverage.sectorsWithIncome)} com renda média disponibilizada.
     </p>
     <p className="mt-2 text-xs leading-relaxed text-slate-600">
      Os dados são carregados de <strong>arquivos locais PMTiles e JSON</strong> publicados no GitHub Pages.
      Ausências, omissões e códigos protegidos pelo sigilo estatístico permanecem N/D, nunca zero.
     </p>
     <p className="mt-2 text-xs leading-relaxed text-slate-600">
      Fontes IBGE: Censo 2022, malha setorial RS, agregados revisados em maio de 2026 e
      rendimento do responsável (2026). Perímetros de bairros: GeoCanoas, adotando
      cruzamento geométrico sem criar populações observadas fictícias.
     </p>
     <p className="mt-3 rounded-xl bg-brand-50 p-3 text-xs text-brand-900">
      <ShieldCheck size={14} className="mr-1 inline"/> Privacidade: valores públicos agregados por setor. Nenhum endereço de
      morador ou localização individual foi incluído nesta camada.
     </p>
     <a href={census.sourceGeometry} target="_blank" rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 underline">
      Malha setorial IBGE oficial <ExternalLink size={12}/></a>
    </article>
   </section>
  </>}
 </main>;
}
