"use client";

import Link from "next/link";
import {useEffect,useMemo,useRef,useState} from "react";
import maplibregl,{LngLatBounds,type ExpressionSpecification} from "maplibre-gl";
import {PMTiles,Protocol,type Source} from "pmtiles";
import {Building2,Download,Layers3,MapPinned,Info,ExternalLink,Search} from "lucide-react";
import type {BairrosGeoData,BairrosGeoHistory,BairrosGeoRow,BairrosSnapshot} from "@/types/bairros";

const base=process.env.NEXT_PUBLIC_BASE_PATH||"";
const number=new Intl.NumberFormat("pt-BR");
const decimal=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2});
const COLORS=["#d5eee3","#a7d9c5","#73bda2","#359b79","#116b55"];
type Metric="active"|"density"|"per1000";
type Choice={id:number;name:string;value:number|null;row:BairrosGeoRow};
type State={snapshot:BairrosSnapshot;metric:Metric;sector:string;choices:Choice[]};
const textMetric:Record<Metric,string>={active:"Estabelecimentos ativos",density:"Estabelecimentos por km²",per1000:"Estabelecimentos por mil habitantes"};
function displayed(r:BairrosGeoRow,metric:Metric,sector:string):number|null{
 const count=sector==="all"?r.active:r.sectorCounts[sector]??null;
 if(count===null||count===undefined)return null;
 if(metric==="active")return count;
 if(metric==="density")return r.areaKm2>0?Math.round((count/r.areaKm2)*100)/100:null;
 if(!r.population2022||r.population2022<=0)return null;
 return Math.round((count/r.population2022)*100000)/100;
}
function formatted(value:number|null,metric:Metric){
 if(value===null)return "N/D";
 return metric==="active"?number.format(value):decimal.format(value);
}
function thresholds(choices:Choice[]):number[]{
 const sorted=choices.map(r=>r.value).filter((v):v is number=>v!==null&&Number.isFinite(v)).sort((a,b)=>a-b);
 if(!sorted.length)return [];
 const unique=Array.from(new Set([.2,.4,.6,.8].map(q=>sorted[Math.floor((sorted.length-1)*q)]))).filter(x=>x>sorted[0]);
 return unique;
}
function colorExpression(choices:Choice[]):ExpressionSpecification{
 const steps=thresholds(choices);
 const byId:unknown[]=[];
 for(const x of choices)if(x.value!==null)byId.push(x.id,x.value);
 const match=byId.length?["match",["get","oid"],...byId,-1]:["literal",-1];
 const lookup:unknown[]=["step",match,COLORS[0]];
 steps.forEach((t,i)=>{lookup.push(t,COLORS[Math.min(i+1,COLORS.length-1)]);});
 return ["case",["==",match,-1],"#e2e8f0",lookup] as unknown as ExpressionSpecification;
}
function appendLine(root:HTMLElement,label:string,value:string){
 const p=document.createElement("p");p.className="py-1";
 const bold=document.createElement("strong");bold.textContent=label+": ";
 p.append(bold,document.createTextNode(value));root.append(p);
}
function csvExport(snapshot:BairrosSnapshot,metric:Metric,sector:string){
 const head=["municipio_ibge","referencia_cnpj","bairro_oficial","objectid_arcgis","cnpj_ativo_no_bairro","populacao_geocanoas_2022","area_km2","indicador","setor_cnae","valor"];
 const rows=snapshot.neighborhoods.map(r=>["4304606",snapshot.reference,r.name,String(r.id),String(r.active??""),String(r.population2022??""),String(r.areaKm2),metric,sector,String(displayed(r,metric,sector)??"")]);
 const quote=(s:string)=>'"'+(/^[=+\-@]/.test(s)&&!/^-?\d+(\.\d+)?$/.test(s)?"'"+s:s).replaceAll('"','""')+'"';
 const csv="\ufeff"+[head,...rows].map(row=>row.map(quote).join(";")).join("\r\n");
 const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
 const a=document.createElement("a");a.href=url;a.download="canoas-bairros-"+snapshot.reference+"-"+metric+".csv";a.click();URL.revokeObjectURL(url);
}
export function BairrosDashboard(){
 const element=useRef<HTMLDivElement|null>(null);
 const mapRef=useRef<maplibregl.Map|null>(null);
 const protocolRef=useRef<Protocol|null>(null);
 const latest=useRef<State|null>(null);
 const [data,setData]=useState<BairrosGeoData|null>(null);
 const [history,setHistory]=useState<BairrosGeoHistory|null>(null);
 const [loadError,setLoadError]=useState("");
 const [mapError,setMapError]=useState("");
 const [ready,setReady]=useState(false);
 const [metric,setMetric]=useState<Metric>("active");
 const [sector,setSector]=useState("all");
 const [reference,setReference]=useState("");
 const [selected,setSelected]=useState<number|null>(null);
 const [search,setSearch]=useState("");
 const [basemap,setBasemap]=useState(true);

 useEffect(()=>{
  const ctrl=new AbortController();
  Promise.all([
   fetch(base+"/data/bairros-economia.json",{signal:ctrl.signal,cache:"no-store"}).then(r=>{if(!r.ok)throw Error("Metadados HTTP "+r.status);return r.json()}),
   fetch(base+"/data/bairros-economia-series.json",{signal:ctrl.signal,cache:"no-store"}).then(r=>{if(!r.ok)throw Error("Arquivo histórico HTTP "+r.status);return r.json()})
  ]).then(([current,past]:[BairrosGeoData,BairrosGeoHistory])=>{
   if(current.territory!=="4304606"||past.territory!=="4304606"||current.schemaVersion!==1||past.schemaVersion!==1)throw Error("Território diferente de Canoas");
   setData(current);setHistory(past);setReference(current.reference||"");
  }).catch(e=>{if(e.name!=="AbortError")setLoadError(String(e));});
  return ()=>ctrl.abort();
 },[]);
 const snapshot=useMemo(()=>{
  const past=history?.snapshots.find(s=>s.reference===reference);
  if(past)return past;
  if(data?.status==="verified"&&data.reference&&data.coverage){
   return {reference:data.reference,generatedAt:data.generatedAt||"",geometrySource:data.sourceUrl,
    sourceYearPopulation:2022,neighborhoods:data.neighborhoods,coverage:data.coverage,unmatched:data.unmatched};
  }
  return null;
 },[data,history,reference]);
 const choices=useMemo<Choice[]>(()=>snapshot?snapshot.neighborhoods.map(row=>({id:row.id,name:row.name,
  value:displayed(row,metric,sector),row})).sort((a,b)=>(b.value??-1)-(a.value??-1)):[],[snapshot,metric,sector]);
 latest.current=snapshot?{snapshot,metric,sector,choices}:null;
 const summary=choices.filter(x=>x.value!==null);
 const selectedRow=choices.find(x=>x.id===selected);
 const noData=choices.filter(x=>x.value===null).length;
 const legend=thresholds(choices);

 useEffect(()=>{
  if(data?.status!=="verified"||!data.pmtiles||!element.current)return;
  let aborted=false;
  let map:maplibregl.Map|null=null;
  let registered=false;
  setMapError("");setReady(false);
  (async()=>{
   const url=window.location.origin+base+data.pmtiles!.path;
   const r=await fetch(url,{cache:"no-store"});
   if(!r.ok)throw Error("PMTiles HTTP "+r.status);
   // Fetch a small municipal archive once: Github Pages may not honor Range
   // requests consistently. A buffered Source still serves actual PMTiles v3.
   const bytes=new Uint8Array(await r.arrayBuffer());
   if(bytes.byteLength<130||bytes.byteLength>15_000_000)throw Error("Arquivo PMTiles fora dos limites de segurança");
   if(bytes[0]!==80||bytes[1]!==77||bytes[7]!==3)throw Error("Formato PMTiles v3 inválido");
   if(aborted)return;
   const source:Source={
    getKey:()=>url,
    async getBytes(offset:number,length:number){
     if(offset<0||length<0||offset+length>bytes.length)throw Error("Requisição fora do arquivo PMTiles");
     return {data:bytes.slice(offset,offset+length).buffer as ArrayBuffer};
    },
   };
   const pm=new PMTiles(source);
   const header=await pm.getHeader();
   if(header.tileType!==1)throw Error("PMTiles não contém camada vetorial");
   if(aborted)return;
   const protocol=new Protocol();protocol.add(pm);
   maplibregl.addProtocol("pmtiles",protocol.tile);protocolRef.current=protocol;registered=true;
   map=new maplibregl.Map({
    container:element.current!,center:[-51.19,-29.915],zoom:11,minZoom:9,maxZoom:16,
    style:{version:8,glyphs:"https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",sources:{
     osm:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,
      attribution:"© OpenStreetMap contributors"},
     bairros:{type:"vector",url:"pmtiles://"+url,attribution:"© GeoCanoas — Prefeitura de Canoas"}
    },layers:[
     {id:"base-osm",type:"raster",source:"osm"},
     {id:"bairros-fill",type:"fill",source:"bairros","source-layer":"bairros",
      paint:{"fill-color":"#b4d9c8","fill-opacity":.77}},
     {id:"bairros-border",type:"line",source:"bairros","source-layer":"bairros",
      paint:{"line-color":"#245449","line-width":1.35}},
     {id:"bairros-selected",type:"line",source:"bairros","source-layer":"bairros",
      filter:["==",["get","oid"],-1],paint:{"line-color":"#da741c","line-width":4}},
     {id:"bairros-name",type:"symbol",source:"bairros","source-layer":"bairros",
      layout:{"text-field":["get","bairro"],"text-size":11,"text-max-width":12,
       "text-font":["Open Sans Regular","Arial Unicode MS Regular"]},
      paint:{"text-color":"#163d35","text-halo-color":"#ffffff","text-halo-width":1.2}}
    ]},
   });
   mapRef.current=map;
   map.addControl(new maplibregl.NavigationControl({showCompass:false}),"top-right");
   map.on("load",()=>{
    if(aborted)return;
    const bounds=new LngLatBounds(
     [header.minLon,header.minLat],[header.maxLon,header.maxLat]);
    if(!bounds.isEmpty())map!.fitBounds(bounds,{padding:25,duration:0,maxZoom:12.8});
    setReady(true);
   });
   map.on("click","bairros-fill",(e)=>{
    const properties=e.features?.[0]?.properties;
    const id=Number(properties?.oid);
    const state=latest.current;
    const row=state?.choices.find(x=>x.id===id);
    if(!row||!map)return;
    setSelected(id);
    const root=document.createElement("div");
    const h=document.createElement("strong");h.textContent=row.name;root.append(h);
    appendLine(root,"CNPJs ativos",row.row.active===null?"N/D":number.format(row.row.active));
    appendLine(root,"Área",decimal.format(row.row.areaKm2)+" km²");
    appendLine(root,"População de referência",row.row.population2022===null?"N/D":number.format(row.row.population2022)+" (GeoCanoas 2022)");
    appendLine(root,textMetric[state!.metric],formatted(row.value,state!.metric));
    if(state!.sector!=="all"){
     const p=document.createElement("p");p.className="text-xs text-slate-600";
     p.textContent="Recorte por CNAE: apenas células publicáveis (≥ 5).";root.append(p);
    }
    new maplibregl.Popup({maxWidth:"285px"}).setLngLat(e.lngLat).setDOMContent(root).addTo(map);
   });
   map.on("mouseenter","bairros-fill",()=>{if(map)map.getCanvas().style.cursor="pointer";});
   map.on("mouseleave","bairros-fill",()=>{if(map)map.getCanvas().style.cursor="";});
   map.on("error",e=>{const message=String(e.error?.message||"");if(!aborted&&/pmtiles|bairros|source-layer|vector tile/i.test(message))setMapError(message);});
  })().catch(e=>{if(!aborted)setMapError(String(e));});
  return ()=>{aborted=true;map?.remove();if(registered)maplibregl.removeProtocol("pmtiles");protocolRef.current=null;mapRef.current=null;};
 },[data]);
 useEffect(()=>{
  const map=mapRef.current;
  if(!map||!ready)return;
  map.setPaintProperty("bairros-fill","fill-color",colorExpression(choices));
  map.setFilter("bairros-selected",["==",["get","oid"],selected??-1]);
 },[choices,ready,selected]);
 useEffect(()=>{
  const map=mapRef.current;
  if(!map||!ready)return;
  map.setLayoutProperty("base-osm","visibility",basemap?"visible":"none");
 },[basemap,ready]);

 return <main className="mx-auto max-w-[1500px] space-y-5 px-4 pb-16 pt-8 text-ink sm:px-6">
  <Link href="/" className="text-sm font-semibold text-brand-700">← Observatório econômico</Link>
  <Link href="/hex500" className="ml-4 inline-flex items-center rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-bold text-brand-900">Hexágonos 500 m e mapa de calor →</Link>
  <header className="flex flex-wrap items-end justify-between gap-4">
   <div className="max-w-4xl"><span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700"><MapPinned size={15}/> GeoCanoas · BAIRROSOFICIAL · PMTiles</span>
    <h1 className="mt-3 text-2xl font-extrabold sm:text-4xl">Geografia das empresas de Canoas</h1>
    <p className="mt-2 text-sm leading-relaxed text-slate-600">Empresas ativas por bairro oficial, setor econômico e indicadores de densidade territorial. Endereços da Receita são declaratórios e <strong>não representam pontos geocodificados</strong>.</p>
   </div>
   {snapshot&&<button onClick={()=>csvExport(snapshot,metric,sector)} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white"><Download size={15}/> Exportar bairros CSV</button>}
  </header>
  {loadError&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{loadError}</p>}
  {data?.status==="not_loaded"&&<p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">O primeiro tileset municipal está em preparação e só será ativado após a validação das geometrias oficiais e dos agregados empresariais. Nenhum bairro foi desenhado artificialmente.</p>}
  {!data&&!loadError&&<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Carregando estatísticas de bairros oficiais…</p>}
  {snapshot&&data?.status==="verified"&&<>
   <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {[
     ["Bairros oficiais",String(snapshot.neighborhoods.length),"Polígonos GeoCanoas"],
     ["CNPJs ativos classificados",number.format(snapshot.coverage.matched),"Por bairro reconhecido"],
     ["Cobertura territorial",decimal.format(snapshot.coverage.matchedPercent)+"%","Dos estabelecimentos ativos"],
     ["Sem atribuição no mapa",number.format(snapshot.coverage.activeTotal-snapshot.coverage.matched),"Inclui não publicados e ambiguidades"],
    ].map(([label,value,note])=><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card" key={label}>
     <p className="text-xs font-bold uppercase leading-relaxed text-slate-500">{label}</p>
     <p className="mt-2 break-words text-2xl font-extrabold tabular-nums">{value}</p>
     <p className="mt-2 text-xs leading-relaxed text-slate-500">{note}</p>
    </div>)}
   </section>
   <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
    <label className="text-xs font-bold text-slate-600">Competência CNPJ
     <select value={snapshot.reference} onChange={e=>{setReference(e.target.value);setSelected(null);}} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal">{(history?.snapshots||[]).map(r=><option key={r.reference} value={r.reference}>{r.reference}</option>)}</select>
    </label>
    <label className="text-xs font-bold text-slate-600">Indicador
     <select value={metric} onChange={e=>{setMetric(e.target.value as Metric);setSelected(null);}} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal">
      <option value="active">Quantidade de estabelecimentos</option>
      <option value="density">Estabelecimentos por km²</option>
      <option value="per1000">Estabelecimentos por mil habitantes</option>
     </select>
    </label>
    <label className="text-xs font-bold text-slate-600">Seção CNAE
     <select value={sector} onChange={e=>{setSector(e.target.value);setSelected(null);}} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal">
      <option value="all">Todos os setores</option>
      {(data.sectors||[]).map(s=><option key={s.code} value={s.code}>{s.code} · {s.label}</option>)}
     </select>
    </label>
    <label className="text-xs font-bold text-slate-600">Cartografia
     <select value={basemap?"osm":"clean"} onChange={e=>setBasemap(e.target.value==="osm")} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal">
      <option value="osm">Ruas e referências OSM</option><option value="clean">Somente bairros oficiais</option>
     </select>
    </label>
   </section>
   <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_345px]">
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-card sm:p-4">
     <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-bold"><Layers3 size={16}/> {textMetric[metric]}</h2><span className="text-xs font-semibold text-slate-500">Clique em um bairro</span></div>
     <div className="relative">
      <div ref={element} className="h-[390px] overflow-hidden rounded-xl bg-slate-100 sm:h-[560px]" role="region" aria-label="Mapa vetorial PMTiles oficial dos dezoito bairros de Canoas"/>
      {!ready&&!mapError&&<div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/80 text-center text-sm font-semibold text-slate-600">Carregando PMTiles e limites oficiais…</div>}
      {mapError&&<div role="alert" className="absolute inset-0 flex items-center justify-center bg-white/90 p-5 text-center text-sm text-amber-900">PMTiles indisponível: {mapError}</div>}
     </div>
     <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
      <span>Sem correspondência</span><span className="h-3 w-4 rounded-sm bg-slate-200"/>
      {COLORS.slice(0,legend.length+1).map((color,i)=><span className="inline-flex items-center gap-1" key={color}><span className="h-3 w-4 rounded-sm" style={{background:color}}/>{i===0?"Menor":i===legend.length?"Maior":""}</span>)}
      <span className="font-semibold">{summary.length} bairros com indicador · {noData} sem valor</span>
     </div>
     <p className="mt-3 text-xs leading-relaxed text-slate-500">As áreas são polígonos oficiais do GeoCanoas. A densidade usa a área em EPSG:31982. A taxa por população utiliza o campo 2022 da própria camada oficial, não o total municipal do IBGE.</p>
    </div>
    <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
     <h2 className="text-base font-extrabold">Ranking territorial</h2>
     <p className="mt-1 text-xs leading-relaxed text-slate-500">Classificação dos 18 bairros pelo indicador e competência selecionados.</p>
     <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar bairro" className="w-full text-sm outline-none" aria-label="Buscar bairro"/></label>
     <div className="mt-3 max-h-[490px] space-y-1.5 overflow-y-auto">
      {choices.filter(r=>r.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))).map((c,i)=><button key={c.id} onClick={()=>setSelected(c.id)}
       className={"flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-3 text-left transition-colors "+(selected===c.id?"border-brand-600 bg-brand-50":"border-slate-100 bg-slate-50 hover:border-brand-200")}>
       <span className="min-w-0"><span className="block text-xs font-bold text-slate-700">{i+1}. {c.name}</span><span className="mt-1 block text-[11px] text-slate-500">{decimal.format(c.row.areaKm2)} km²</span></span>
       <strong className="shrink-0 text-sm tabular-nums">{formatted(c.value,metric)}</strong>
      </button>)}
     </div>
     {selectedRow&&<div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 p-3 text-xs leading-relaxed">
       <strong>{selectedRow.name}</strong><p className="mt-1">CNPJs ativos: {formatted(selectedRow.row.active,"active")}</p>
       <p>População 2022 (GeoCanoas): {selectedRow.row.population2022===null?"N/D":number.format(selectedRow.row.population2022)}</p>
       <p>Indicador selecionado: {formatted(selectedRow.value,metric)}</p>
      </div>}
    </aside>
   </section>
   <div className="grid gap-4 lg:grid-cols-2">
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
     <h2 className="flex items-center gap-2 text-sm font-bold"><Info size={17}/> Qualidade da atribuição territorial</h2>
     <p className="mt-2 text-xs leading-relaxed text-slate-600">{number.format(snapshot.coverage.matched)} ativos vinculados a bairros oficiais; {number.format(snapshot.coverage.unmatchedPublished)} ativos de denominações publicadas não conciliadas e {number.format(snapshot.coverage.notPublishedByThreshold)} fora dos 50 grupos publicados/limiar. Essas diferenças não foram rateadas nem geocodificadas.</p>
     <div className="mt-3 max-h-[180px] overflow-auto text-xs text-slate-600">{snapshot.unmatched.slice(0,30).map(e=><p key={e.name} className="flex justify-between gap-2 border-b border-slate-100 py-1.5"><span>{e.name}</span><span className="font-semibold">{number.format(e.count)}</span></p>)}</div>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
     <h2 className="text-sm font-bold">Fontes e ressalvas</h2>
     <p className="mt-2 text-xs leading-relaxed text-slate-600">Fonte cartográfica: <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">GeoCanoas / BAIRROSOFICIAL <ExternalLink size={12} className="inline"/></a>. Empresas: Receita Federal, referência {snapshot.reference}. PMTiles vetorial disponível em arquivo estático.</p>
     <p className="mt-2 text-xs leading-relaxed text-slate-600">Soma do campo populacional 2022 desta camada: {number.format(data.population2022LayerSum||0)}. Esse valor não deve ser equiparado automaticamente ao Censo municipal do painel principal.</p>
     <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-slate-500">{data.notes.slice(0,6).map((note,i)=><li key={i}>{note}</li>)}</ul>
     {sector!=="all"&&<p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Setores CNAE: os dados originais omitem combinações bairro × seção com menos de cinco registros. As quantidades mostradas são limites inferiores, não totais exatos.</p>}
    </section>
   </div>
   <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="text-sm font-bold">Próxima camada de precisão: endereços CNPJ</h2>
    <p className="mt-2 text-xs leading-relaxed text-slate-600">Esta versão publica dados <strong>por polígono de bairro</strong>. Para gerar PMTiles de pontos, grades ou mapas de calor, será necessária a correspondência comprovada dos endereços completos da Receita com logradouros e lotes oficiais, com proteção de endereços residenciais e um indicador de precisão por localização. Não usamos centroides de bairros como se fossem empresas.</p>
    <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold"><Link href="/cnpj" className="text-brand-700 underline">Ver estatísticas CNPJ</Link><Link href="/sebrae/series" className="text-brand-700 underline">Séries econômicas do Sebrae</Link></div>
   </section>
  </>}
 </main>;
}
