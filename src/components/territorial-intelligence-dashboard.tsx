"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import maplibregl,{LngLatBounds,type ExpressionSpecification} from "maplibre-gl";
import {PMTiles,Protocol,type Source} from "pmtiles";
import {ArrowDownUp,Download,Layers3,MapPinned,Search,ShieldCheck,ExternalLink} from "lucide-react";
import {OPENFREEMAP_POSITRON,installCanoasOverlays,setBasemapVisible} from "@/lib/openfreemap-basemap";
import type {BairrosGeoData} from "@/types/bairros";
import {
 BIVARIATE_COLORS,NODATA,SINGLE_COLORS,buildComparison,comparisonColor,
 displayValue,fifthBreaks,type Comparison,type ObservedInput,type Statistic
} from "@/lib/territorial-comparison";

const prefix=process.env.NEXT_PUBLIC_BASE_PATH||"";
const integer=new Intl.NumberFormat("pt-BR");
const decimal=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2});
type HexSource={schemaVersion:number;status:string;territory:string;reference:string;
 spatialOverlayVersion?:number;spatialTopology?:{neighborhoods:ObservedInput[];
  ambiguousOfficialAreaKm2?:number;unassignedCnefePointBoundary?:number;ambiguousCnefePointBoundary?:number};};
type Labels={type:"FeatureCollection";features:Array<{properties:{bairro:string};geometry:{type:"Point";coordinates:number[]}}>};
const views:{id:Statistic;name:string;help:string}[]=[
 {id:"bivariate",name:"Concentração combinada",help:"CNPJ declarado × endereços CNEFE observados"},
 {id:"cnpjDensity",name:"CNPJs por km²",help:"RFB 2026 · declaração de bairro"},
 {id:"cnefeDensity",name:"Endereços por km²",help:"IBGE CNEFE 2022 · coordenadas observadas"},
 {id:"quality",name:"Precisão CNEFE",help:"Endereços com níveis 1–2 entre os geolocalizados"}
];
function fmt(n:number|null|undefined,unit?:string){
 return n===null||n===undefined||!Number.isFinite(n)?"N/D":decimal.format(n)+(unit?" "+unit:"");
}
function exportData(rows:Comparison[],ref:string){
 const heading=["codigo_ibge","referencia_cnpj","referencia_cnefe","bairro","area_km2","populacao_geo_2022",
  "cnpj_ativos_declarados","cnpj_por_km2","cnefe_enderecos_nao_residenciais",
  "cnefe_por_km2","cnefe_qualidade_alta","cnefe_precisao_pct","classe_cnpj_tercil","classe_cnefe_tercil",
  "celulas_inteiras_no_bairro","fragmentos_de_divisa"];
 const table=[heading,...rows.map(r=>["4304606",ref,"2022",r.name,r.areaKm2,r.population2022,
   r.cnpjActive,r.cnpjPerKm2,r.cnefeObserved,r.cnefePerKm2,r.cnefeHigh,r.highQualityPct,
   r.x===null?null:r.x+1,r.y===null?null:r.y+1,r.fullCells,r.borderFragments])];
 const quoted=(v:string|number|null)=>'"'+(v===null?"":String(v).replaceAll('"','""'))+'"';
 const csv="\ufeff"+table.map(row=>row.map(quoted).join(";")).join("\r\n");
 const uri=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
 const link=document.createElement("a");link.href=uri;
 link.download="canoas-territorio-bivariado-"+ref+".csv";link.click();URL.revokeObjectURL(uri);
}
function legendRows(view:Statistic,rows:Comparison[]){
 if(view==="bivariate")return null;
 const values=rows.map(r=>displayValue(r,view)).filter((v):v is number=>v!==null);
 return fifthBreaks(values);
}
const inline=(name:string,value:string)=>{
 const p=document.createElement("p");p.className="py-1 text-xs";
 const b=document.createElement("strong");b.textContent=name+": ";
 p.append(b,document.createTextNode(value));return p;
};

export function TerritorialIntelligenceDashboard(){
 const node=useRef<HTMLDivElement|null>(null);
 const mapRef=useRef<maplibregl.Map|null>(null);
 const snapshot=useRef<{rows:Comparison[];view:Statistic}|null>(null);
 const [cnpj,setCnpj]=useState<BairrosGeoData|null>(null);
 const [cnefe,setCnefe]=useState<HexSource|null>(null);
 const [labels,setLabels]=useState<Labels|null>(null);
 const [error,setError]=useState("");
 const [mapError,setMapError]=useState("");
 const [ready,setReady]=useState(false);
 const [view,setView]=useState<Statistic>("bivariate");
 const [selected,setSelected]=useState<number|null>(null);
 const [search,setSearch]=useState("");
 const [sortBy,setSortBy]=useState<"cnpj"|"cnefe">("cnpj");
 const [background,setBackground]=useState(true);

 useEffect(()=>{
  const ctrl=new AbortController();
  Promise.all([
   fetch(prefix+"/data/bairros-economia.json",{signal:ctrl.signal,cache:"no-store"}).then(r=>{if(!r.ok)throw Error("Bairros HTTP "+r.status);return r.json()}),
   fetch(prefix+"/data/cnefe-hex500.json",{signal:ctrl.signal,cache:"no-store"}).then(r=>{if(!r.ok)throw Error("CNEFE HTTP "+r.status);return r.json()}),
   fetch(prefix+"/data/bairros-rotulos.geojson",{signal:ctrl.signal}).then(r=>{if(!r.ok)throw Error("Rótulos HTTP "+r.status);return r.json()})
  ]).then(([a,b,l]:[BairrosGeoData,HexSource,Labels])=>{
   if(a.territory!=="4304606"||b.territory!=="4304606"||a.status!=="verified"||
    b.status!=="verified"||b.spatialOverlayVersion!==1||!b.spatialTopology||
    l.features?.length!==18||a.neighborhoods?.length!==18)throw Error("Bases oficiais incompatíveis");
   buildComparison(a.neighborhoods,b.spatialTopology.neighborhoods);
   setCnpj(a);setCnefe(b);setLabels(l);
  }).catch(e=>{if(e.name!=="AbortError")setError(String(e.message||e));});
  return ()=>ctrl.abort();
 },[]);
 const rows=useMemo(()=>cnpj&&cnefe?.spatialTopology?
  buildComparison(cnpj.neighborhoods,cnefe.spatialTopology.neighborhoods):[],[cnpj,cnefe]);
 const breaks=useMemo(()=>legendRows(view,rows)||[],[view,rows]);
 const chosen=rows.find(r=>r.id===selected);
 const ranked=useMemo(()=>rows.filter(r=>r.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")))
  .sort((a,b)=>(sortBy==="cnpj"?(b.cnpjPerKm2??-1)-(a.cnpjPerKm2??-1):
   (b.cnefePerKm2??-1)-(a.cnefePerKm2??-1))),[rows,search,sortBy]);
 const comparable=rows.filter(r=>r.classIndex!==null).length;
 const qualityCount=rows.filter(r=>r.highQualityPct!==null).length;
 snapshot.current={rows,view};
 const anchors=useMemo(()=>new Map<string,number[]>(labels?.features.map(f=>[f.properties.bairro,f.geometry.coordinates] as [string,number[]])||[]),[labels]);

 useEffect(()=>{
  if(!cnpj?.pmtiles||!node.current||!cnefe||!labels)return;
  let map:maplibregl.Map|null=null,disposed=false,registered=false;
  setReady(false);setMapError("");
  (async()=>{
   const url=window.location.origin+prefix+cnpj.pmtiles!.path;
   const response=await fetch(url,{cache:"no-store"});
   if(!response.ok)throw Error("PMTiles bairros HTTP "+response.status);
   const bytes=new Uint8Array(await response.arrayBuffer());
   if(bytes.length<130||bytes.length>15_000_000||bytes[0]!==80||bytes[1]!==77||bytes[7]!==3)
    throw Error("PMTiles de bairros não validado");
   if(bytes.length!==cnpj.pmtiles!.bytes)throw Error("Tamanho PMTiles difere do catálogo verificado");
   if(disposed)return;
   const source:Source={getKey:()=>url,async getBytes(offset:number,length:number){
    if(offset<0||length<0||offset+length>bytes.length)throw Error("PMTiles intervalo inválido");
    return {data:bytes.slice(offset,offset+length).buffer as ArrayBuffer};
   }};
   const archive=new PMTiles(source);
   const header=await archive.getHeader();
   if(header.tileType!==1)throw Error("PMTiles não é vetorial");
   if(disposed)return;
   const protocol=new Protocol();protocol.add(archive);
   maplibregl.addProtocol("pmtiles",protocol.tile);registered=true;
   const overlays:maplibregl.StyleSpecification={version:8,sources:{
    bairros:{type:"vector",url:"pmtiles://"+url,attribution:"© GeoCanoas · Prefeitura de Canoas"},
    rotulos:{type:"geojson",data:prefix+"/data/bairros-rotulos.geojson"}
   },layers:[
    {id:"compare-fill",type:"fill",source:"bairros","source-layer":"bairros",
     paint:{"fill-color":"#d5eee3","fill-opacity":.85}},
    {id:"compare-border",type:"line",source:"bairros","source-layer":"bairros",
     paint:{"line-color":"#365b59","line-width":1.2}},
    {id:"compare-selected",type:"line",source:"bairros","source-layer":"bairros",
     filter:["==",["get","oid"],-1],
     paint:{"line-color":"#c56b24","line-width":4}},
    {id:"compare-names",type:"symbol",source:"rotulos",
     layout:{"text-field":["get","bairro"],"text-font":["Noto Sans Regular"],"text-size":11,"text-max-width":13},
     paint:{"text-color":"#183b37","text-halo-color":"#fff","text-halo-width":1.3}}
   ]};
   map=new maplibregl.Map({container:node.current!,
    center:[-51.19,-29.915],zoom:11,minZoom:9,maxZoom:16,style:OPENFREEMAP_POSITRON});
   mapRef.current=map;
   map.addControl(new maplibregl.NavigationControl({showCompass:false}),"top-right");
   const current=map;
   map.on("load",()=>{
    if(disposed)return;
    installCanoasOverlays(current,overlays);
    const bounds=new LngLatBounds([header.minLon,header.minLat],[header.maxLon,header.maxLat]);
    if(!bounds.isEmpty())current.fitBounds(bounds,{padding:22,duration:0,maxZoom:12.7});
    setReady(true);
   });
   map.on("click","compare-fill",event=>{
    const id=Number(event.features?.[0]?.properties?.oid);
    const state=snapshot.current;
    const row=state?.rows.find(item=>item.id===id);
    if(!row)return;
    setSelected(id);
    const root=document.createElement("div"),title=document.createElement("strong");
    title.textContent=row.name;root.append(title);
    root.append(inline("CNPJs declarados",fmt(row.cnpjActive)));
    root.append(inline("Densidade CNPJ",fmt(row.cnpjPerKm2,"/km²")));
    root.append(inline("Endereços CNEFE observados",fmt(row.cnefeObserved)));
    root.append(inline("Densidade CNEFE",fmt(row.cnefePerKm2,"/km²")));
    root.append(inline("Alta qualidade CNEFE",fmt(row.highQualityPct,"%")));
    root.append(inline("Classe do mapa",row.classIndex===null?"Indisponível":
      "CNPJ "+(row.x!+1)+"/3 · CNEFE "+(row.y!+1)+"/3"));
    new maplibregl.Popup({maxWidth:"305px"}).setLngLat(event.lngLat).setDOMContent(root).addTo(current);
   });
   map.on("mouseenter","compare-fill",()=>{current.getCanvas().style.cursor="pointer";});
   map.on("mouseleave","compare-fill",()=>{current.getCanvas().style.cursor="";});
   map.on("error",e=>{
    const message=String(e.error?.message||"");
    if(!disposed&&/pmtiles|bairros|vector tile|source-layer/i.test(message))setMapError(message);
   });
  })().catch(e=>{if(!disposed)setMapError(String(e));});
  return ()=>{disposed=true;map?.remove();if(registered)maplibregl.removeProtocol("pmtiles");mapRef.current=null;};
 },[cnpj,cnefe,labels]);

 useEffect(()=>{
  const map=mapRef.current;
  if(!ready||!map)return;
  const palette:unknown[]=["match",["get","oid"]];
  for(const r of rows)palette.push(r.id,comparisonColor(r,view,breaks));
  palette.push(NODATA);
  map.setPaintProperty("compare-fill","fill-color",palette as ExpressionSpecification);
  map.setFilter("compare-selected",["==",["get","oid"],selected??-1]);
 },[ready,rows,view,breaks,selected]);
 useEffect(()=>{
  const map=mapRef.current;if(ready&&map)setBasemapVisible(map,background);
 },[background,ready]);

 const focus=(row:Comparison)=>{
  setSelected(row.id);
  const xy=anchors.get(row.name);
  if(xy&&mapRef.current)mapRef.current.flyTo({center:[xy[0],xy[1]],zoom:12.5,speed:1.1});
 };
 return <main className="mx-auto max-w-[1500px] space-y-5 px-4 pb-16 pt-8 text-ink sm:px-6">
  <header className="flex flex-wrap items-start justify-between gap-4">
   <div className="max-w-4xl">
    <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">
     <MapPinned size={15}/> GeoCanoas · PMTiles · Análise cruzada
    </span>
    <h1 className="mt-3 text-2xl font-extrabold sm:text-4xl">Inteligência territorial comparativa</h1>
    <p className="mt-2 text-sm leading-relaxed text-slate-600">
     Localização relativa das atividades empresariais declaradas e dos endereços não residenciais georreferenciados.
     Mesmos 18 bairros oficiais, <strong>universos e anos de referência distintos</strong>.
    </p>
   </div>
   {rows.length>0&&<button type="button" onClick={()=>exportData(rows,cnpj?.reference||"sem-ref")}
    className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white">
    <Download size={15}/> Exportar comparação CSV</button>}
  </header>
  {error&&<p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
   Não foi possível validar as duas bases territoriais: {error}</p>}
  {!error&&rows.length===0&&<p className="rounded-xl bg-white p-4 text-sm text-slate-600">Carregando as duas bases territoriais oficiais…</p>}
  {rows.length>0&&<>
   <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {[
     ["Bairros comparáveis",integer.format(comparable)+" / 18","Ambos os indicadores disponíveis"],
     ["CNPJs territorializados",integer.format(cnpj?.coverage?.matched||0),"Bairro declarado · RFB "+(cnpj?.reference||"")],
     ["Endereços CNEFE 2022",integer.format(cnefe?.spatialTopology?.neighborhoods.reduce((s,r)=>s+(r.observedAddresses||0),0)||0),"Subtotal publicável; zeros e suprimidos distintos"],
     ["Precisão mensurável",integer.format(qualityCount)+" / 18","Bairros com razão CNEFE publicável"],
    ].map(([label,value,note])=><article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
     <p className="text-xs font-bold uppercase leading-relaxed text-slate-500">{label}</p>
     <p className="mt-2 break-words text-2xl font-extrabold tabular-nums">{value}</p>
     <p className="mt-2 text-xs leading-relaxed text-slate-500">{note}</p>
    </article>)}
   </section>
   <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
    <label className="text-xs font-bold text-slate-600">Modo cartográfico
     <select value={view} onChange={e=>setView(e.target.value as Statistic)}
      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal">
      {views.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
     </select>
    </label>
    <label className="text-xs font-bold text-slate-600">Ranking por
     <select value={sortBy} onChange={e=>setSortBy(e.target.value as "cnpj"|"cnefe")}
      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal">
      <option value="cnpj">Densidade de CNPJs declarados</option>
      <option value="cnefe">Densidade de endereços CNEFE</option>
     </select>
    </label>
    <label className="text-xs font-bold text-slate-600">Fundo de mapa
     <select value={background?"osm":"clean"} onChange={e=>setBackground(e.target.value==="osm")}
      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal">
      <option value="osm">Referências OpenStreetMap</option>
      <option value="clean">Somente polígonos oficiais</option>
     </select>
    </label>
   </section>
   <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_355px]">
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-card sm:p-4">
     <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-bold"><Layers3 size={16}/>
       {views.find(x=>x.id===view)?.name}</h2>
      <span className="text-xs text-slate-500">Clique em um bairro para ver detalhes</span>
     </div>
     <div className="relative">
      <div ref={node} className="h-[405px] overflow-hidden rounded-xl bg-slate-100 sm:h-[550px]"
       role="region" aria-label="Mapa bivariado de indicadores territoriais CNPJ declarados e CNEFE com dezoito bairros GeoCanoas"/>
      {!ready&&!mapError&&<div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/80 p-5 text-center text-sm text-slate-600">Carregando cartografia PMTiles oficial…</div>}
      {mapError&&<div className="absolute inset-0 flex items-center justify-center bg-white/90 p-5 text-sm text-amber-900" role="alert">Mapa indisponível: {mapError}</div>}
     </div>
     {view==="bivariate"?
      <div className="mt-4 flex flex-wrap items-start gap-4 text-xs text-slate-600">
       <div className="flex items-center gap-2">
        <span className="max-w-[95px] text-right text-[11px] leading-snug">CNEFE / km² ↑</span>
        <div className="grid grid-cols-3 gap-[3px]" aria-label="Legenda bivariada 3 por 3">
         {[2,1,0].flatMap(y=>[0,1,2].map(x=><span key={y+"-"+x}
          title={"CNEFE "+(y+1)+"/3; CNPJ "+(x+1)+"/3"}
          className="h-6 w-7 rounded-[2px] sm:h-7 sm:w-8"
          style={{backgroundColor:BIVARIATE_COLORS[y][x]}}/>))}
        </div>
       </div>
       <div className="space-y-2 text-[11px] leading-relaxed">
        <p><strong>CNPJ / km² →</strong> baixo · intermediário · alto</p>
        <p>Classes por tercis dos 18 bairros, não limites absolutos de planejamento.</p>
        <p className="flex items-center gap-1.5"><span className="h-3 w-4 bg-slate-200"/> Sem observação publicável</p>
       </div>
      </div>:
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
       <span className="h-3 w-4 rounded bg-slate-200"/> N/D ou valor suprimido
       {SINGLE_COLORS.slice(0,breaks.length+1).map((color,i)=><span key={color} className="inline-flex items-center gap-1">
        <span className="h-3 w-5 rounded" style={{backgroundColor:color}}/>
        {i===0?"Menor":i===breaks.length?"Maior":""}
       </span>)}
      </div>}
     <p className="mt-3 text-xs leading-relaxed text-slate-600">
      {views.find(x=>x.id===view)?.help}. Densidade calculada sobre a área total dos polígonos oficiais em km²;
      células censitárias de divisa <strong>não são rateadas</strong> entre bairros.
     </p>
    </article>
    <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
     <h2 className="flex items-center gap-2 text-base font-bold"><ArrowDownUp size={16}/> Ranking territorial</h2>
     <p className="mt-1 text-xs leading-relaxed text-slate-500">Densidades independentes em cada linha. Selecione um bairro para centralizar o mapa.</p>
     <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
      <Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar bairro"
       className="w-full min-w-0 text-sm outline-none" aria-label="Buscar bairro na comparação"/>
     </label>
     <div className="mt-3 max-h-[450px] space-y-1.5 overflow-y-auto">
      {ranked.map((r,i)=><button key={r.id} type="button" onClick={()=>focus(r)}
       className={"w-full rounded-xl border px-3 py-3 text-left transition-colors "+
        (selected===r.id?"border-brand-600 bg-brand-50":"border-slate-100 bg-slate-50 hover:border-brand-200")}>
       <span className="block text-xs font-bold">{i+1}. {r.name}</span>
       <span className="mt-1 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[11px] text-slate-600">
        <span>CNPJ: <strong>{fmt(r.cnpjPerKm2)}</strong>/km²</span>
        <span>CNEFE: <strong>{fmt(r.cnefePerKm2)}</strong>/km²</span>
       </span>
      </button>)}
     </div>
     {chosen&&<section className="mt-3 rounded-xl border border-brand-100 bg-brand-50 p-3 text-xs leading-relaxed">
      <h3 className="font-bold">{chosen.name}</h3>
      <p className="mt-1">Área oficial: {fmt(chosen.areaKm2,"km²")} · População 2022: {fmt(chosen.population2022)}</p>
      <p>CNPJs ativos no bairro declarado: {fmt(chosen.cnpjActive)}</p>
      <p>Endereços CNEFE não residenciais geolocalizados: {fmt(chosen.cnefeObserved)}</p>
      <p>Qualidade de endereço CNEFE (1–2): {fmt(chosen.highQualityPct,"%")}</p>
      <p>{integer.format(chosen.fullCells)} hexágonos inteiramente contidos e {integer.format(chosen.borderFragments)} fragmentos de divisa.</p>
     </section>}
    </aside>
   </section>
   <section className="grid gap-4 lg:grid-cols-2">
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
     <h2 className="flex items-center gap-2 text-sm font-bold"><ShieldCheck size={17}/> Precisão e limites da comparação</h2>
     <p className="mt-2 text-xs leading-relaxed text-slate-600">
      <strong>CNPJs:</strong> empresas ativas por bairro <em>declarado</em> no cadastro da Receita Federal, competência {cnpj?.reference}.
      A atribuição por nome não equivale à geocodificação ponto a ponto.
     </p>
     <p className="mt-2 text-xs leading-relaxed text-slate-600">
      <strong>CNEFE:</strong> endereços não residenciais do Censo 2022 classificados pelas coordenadas observadas
      diretamente dentro dos limites GeoCanoas. Coordenadas IBGE também podem ter sido estimadas em níveis menos precisos.
      Totais positivos inferiores a 5 são ocultados.
     </p>
     <p className="mt-2 text-xs leading-relaxed text-slate-600">
      <strong>Comparação:</strong> densidades e tercis são independentes. Não expressam taxa de geocodificação,
      correlação causal, crescimento de empresas, nem contagem exata de negócios no mesmo endereço.
     </p>
    </article>
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
     <h2 className="text-sm font-bold">Integridade da cartografia</h2>
     <p className="mt-2 text-xs leading-relaxed text-slate-600">
      Fonte espacial: BAIRROSOFICIAL GeoCanoas, 18 polígonos oficiais, visualização PMTiles v3.
      Os nomes utilizam âncoras únicas, e os dados tabulares são associados pelo nome canônico validado.
     </p>
     <p className="mt-2 text-xs leading-relaxed text-slate-600">
      Área oficial com sobreposições sem atribuição arbitrária:
      {" "}<strong>{fmt(cnefe?.spatialTopology?.ambiguousOfficialAreaKm2??0,"km²")}</strong>.
      Pontos CNEFE em limites ambíguos: {integer.format(cnefe?.spatialTopology?.ambiguousCnefePointBoundary||0)}.
     </p>
     <div className="mt-3 flex flex-col gap-2 text-xs font-semibold text-brand-700">
      <a href={cnpj?.sourceUrl||"https://geo.canoas.rs.gov.br/server/rest/services/BAIRROSOFICIAL/FeatureServer/0"}
       target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
       Fonte cartográfica GeoCanoas <ExternalLink size={12}/></a>
      <a href="https://www.ibge.gov.br/estatisticas/sociais/populacao/38734-censo-2022.html"
       target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
       Referência IBGE CNEFE/Censo 2022 <ExternalLink size={12}/></a>
     </div>
    </article>
   </section>
  </>}
 </main>;
}
