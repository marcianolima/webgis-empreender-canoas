"use client";
import Link from "next/link";
import {useEffect,useMemo,useRef,useState} from "react";
import maplibregl,{LngLatBounds,type ExpressionSpecification} from "maplibre-gl";
import {PMTiles,Protocol,type Source} from "pmtiles";
import {Download,Layers3,Flame,Hexagon,MapPin,ShieldCheck,Info,ExternalLink,Search} from "lucide-react";

const base=process.env.NEXT_PUBLIC_BASE_PATH||"";
const num=new Intl.NumberFormat("pt-BR");
const n2=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2});
const C=["#e4f1eb","#bbdfcf","#80c5a8","#409d7c","#136747"];
type Cell={cell:string;n:number|null;n_high:number|null;a_km2:number;d_km2?:number;
 lon:number;lat:number;[key:string]:string|number|null|undefined};
type SourceData={schemaVersion:1;status:"verified"|"not_loaded";territory:string;reference:string;cellWidthMeters:number;
 generatedAt:string;pmtiles:null|{path:string;layers:string[];bytes:number;sha256:string};
 coverage:null|{allCnefeRecords:number;nonResidentialWithCoordinatesInOfficialBairros:number;
 notInOfficialBairros:number;invalidCoordinates:number;gridCells:number;
 cellsWithNonResidential:number;heatCellsAtLeastFiveHighQualityAddresses:number;
 kindCounts:Record<string,number>;geocodingLevelCounts:Record<string,number>};
 kinds?:Record<string,string>;cells?:Cell[];notes?:string[];privacy?:{individualCoordinatesPublished:boolean};cnpjMatch?:{active:number;matched:number;matchedPercent:number;cellsPublished:number}|null;cnpjReference?:string|null};
type Metric="n"|"n_high"|"d_km2"|"k3"|"k4"|"k5"|"k6"|"k8"|"cnpj";
type Mode="hex"|"heat";
const kinds:Record<string,string>={k3:"Agropecuário",k4:"Ensino",k5:"Saúde",k6:"Outras finalidades",k8:"Religioso"};
const metrics:{id:Metric;label:string}[]=[
 {id:"n",label:"Endereços não domiciliares"}, {id:"n_high",label:"Coordenadas de maior qualidade (1–2)"},
 {id:"cnpj",label:"CNPJs ativos — endereços coincidentes (parcial)"},
 {id:"d_km2",label:"Endereços por km²"},
 {id:"k3",label:"Estabelecimentos agropecuários"}, {id:"k4",label:"Estabelecimentos de ensino"},
 {id:"k5",label:"Estabelecimentos de saúde"}, {id:"k6",label:"Estabelecimentos de outras finalidades"},
 {id:"k8",label:"Estabelecimentos religiosos"}];
function numberIn(cell:Cell,metric:Metric):number|null{
 const x=cell[metric];
 return typeof x==="number"&&Number.isFinite(x)?x:null;
}
function fmt(v:number|null){return v===null?"N/D":n2.format(v);}
function scale(cells:Cell[],metric:Metric){
 const a=cells.map(c=>numberIn(c,metric)).filter((n):n is number=>n!==null).sort((a,b)=>a-b);
 if(!a.length)return [5,10,20,40];
 const low=a[0];
 return Array.from(new Set([0.2,0.4,0.6,0.8].map(q=>a[Math.floor((a.length-1)*q)]))).filter(n=>n>low);
}
function expression(metric:Metric,steps:number[]):ExpressionSpecification{
 const vals:Array<string|number>=[];steps.forEach((step,i)=>{vals.push(step,C[Math.min(i+1,C.length-1)]);});
 return ["case",["has",metric],["step",["to-number",["get",metric]],C[0],...vals],"#e1e5e9"] as unknown as ExpressionSpecification;
}
function add(root:HTMLElement,label:string,value:string){
 const line=document.createElement("p");line.className="py-1";
 const b=document.createElement("strong");b.textContent=label+": ";
 line.append(b,document.createTextNode(value));root.append(line);
}
function csvExport(data:SourceData,cells:Cell[],metric:Metric){
 const header=["territorio_ibge","fonte","referencia","id_hex","largura_faces_m","lon_centro_estatistico","lat_centro_estatistico","area_recortada_km2","indicador","valor"];
 const rows=cells.map(c=>["4304606","IBGE CNEFE 2022","2022",c.cell,"500",String(c.lon),String(c.lat),
  String(c.a_km2),metric,String(numberIn(c,metric)??"")]);
 const quote=(s:string)=>'"'+(/^[=+\-@]/.test(s)&&!/^-?\d+(\.\d+)?$/.test(s)?"'"+s:s).replaceAll('"','""')+'"';
 const csv="\ufeff"+[header,...rows].map(row=>row.map(quote).join(";")).join("\r\n");
 const uri=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
 const a=document.createElement("a");a.href=uri;a.download="canoas-cnefe-hex500-"+metric+".csv";a.click();URL.revokeObjectURL(uri);
}
export function Hex500Dashboard(){
 const canvas=useRef<HTMLDivElement|null>(null);
 const mapRef=useRef<maplibregl.Map|null>(null);
 const current=useRef<{data:SourceData;metric:Metric;cells:Cell[]}|null>(null);
 const [data,setData]=useState<SourceData|null>(null);
 const [error,setError]=useState("");
 const [mapError,setMapError]=useState("");
 const [mapReady,setMapReady]=useState(false);
 const [mode,setMode]=useState<Mode>("hex");
 const [metric,setMetric]=useState<Metric>("n");
 const [selected,setSelected]=useState("");
 const [search,setSearch]=useState("");
 const [osm,setOsm]=useState(true);
 const cells=useMemo(()=>data?.cells||[],[data]);
 const ranking=useMemo(()=>cells.filter(c=>numberIn(c,metric)!==null).sort((a,b)=>(numberIn(b,metric)||0)-(numberIn(a,metric)||0)),[cells,metric]);
 const thresholds=useMemo(()=>scale(cells,metric),[cells,metric]);
 current.current=data?{data,metric,cells}:null;
 const metricLabel=metrics.find(m=>m.id===metric)?.label||metric;
 const highlight=cells.find(c=>c.cell===selected);
 useEffect(()=>{
  const ctl=new AbortController();
  fetch(base+"/data/cnefe-hex500.json",{cache:"no-store",signal:ctl.signal})
   .then(r=>{if(!r.ok)throw Error("CNEFE HTTP "+r.status);return r.json()})
   .then((d:SourceData)=>{if(d.schemaVersion!==1||d.territory!=="4304606")throw Error("Conjunto não é Canoas");setData(d)})
   .catch(e=>{if(e.name!=="AbortError")setError(String(e))});
  return ()=>ctl.abort();
 },[]);
 useEffect(()=>{
  if(data?.status!=="verified"||!data.pmtiles||!canvas.current)return;
  let dead=false;let map:maplibregl.Map|null=null;let registered=false;
  setMapError("");setMapReady(false);
  (async()=>{
   const url=window.location.origin+base+data.pmtiles!.path;
   const resp=await fetch(url);
   if(!resp.ok)throw Error("PMTiles HTTP "+resp.status);
   const raw=new Uint8Array(await resp.arrayBuffer());
   if(raw.length<127||raw.length>15_000_000||raw[0]!==80||raw[1]!==77||raw[7]!==3)throw Error("PMTiles vetorial inválido");
   const source:Source={getKey:()=>url,async getBytes(offset:number,length:number){
      if(offset<0||length<0||offset+length>raw.length)throw Error("Posição inválida no PMTiles");
      return {data:raw.slice(offset,offset+length).buffer as ArrayBuffer};
   }};
   const archive=new PMTiles(source);
   const header=await archive.getHeader();
   if(header.tileType!==1)throw Error("Arquivo não contém MVT");
   if(dead)return;
   const protocol=new Protocol();protocol.add(archive);maplibregl.addProtocol("pmtiles",protocol.tile);registered=true;
   map=new maplibregl.Map({
    container:canvas.current!,
    center:[-51.19,-29.914],zoom:11.2,minZoom:9,maxZoom:16,
    style:{version:8,glyphs:"https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
     sources:{
      osm:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
       tileSize:256,attribution:"© OpenStreetMap contributors"},
      grid:{type:"vector",url:"pmtiles://"+url,
       attribution:"Endereços não domiciliares IBGE CNEFE 2022, polígonos GeoCanoas"},
      bairros:{type:"geojson",data:base+"/data/bairros-oficiais.geojson"},
     },layers:[
      {id:"osm",type:"raster",source:"osm"},
      {id:"hex-fill",type:"fill",source:"grid","source-layer":"hex500",
       paint:{"fill-color":C[2],"fill-opacity":.85}},
      {id:"hex-line",type:"line",source:"grid","source-layer":"hex500",
       paint:{"line-color":"#426b5d","line-width":.45,"line-opacity":.45}},
      {id:"heat",type:"heatmap",source:"grid","source-layer":"heat500",layout:{visibility:"none"},
       paint:{"heatmap-weight":["interpolate",["linear"],["to-number",["get","w"],0],5,.16,100,1],
        "heatmap-intensity":["interpolate",["linear"],["zoom"],9,.6,15,1.5],
        "heatmap-radius":["interpolate",["linear"],["zoom"],9,14,15,35],
        "heatmap-opacity":.82,
        "heatmap-color":["interpolate",["linear"],["heatmap-density"],0,"rgba(0,0,0,0)",.18,"#c7e8dc",.4,"#74bea9",.65,"#f2ce7c",.85,"#e28b45",1,"#b94a37"]}},
      {id:"official-border",type:"line",source:"bairros",
       paint:{"line-color":"#122f33","line-width":2}},
      {id:"official-label",type:"symbol",source:"bairros",
       layout:{"text-field":["get","BAIRRO"],"text-size":11,"text-font":["Open Sans Regular","Arial Unicode MS Regular"],"text-max-width":10},
       paint:{"text-color":"#173c35","text-halo-color":"#ffffff","text-halo-width":1.2}},
      {id:"selected-hex",type:"line",source:"grid","source-layer":"hex500",
       filter:["==",["get","cell"],"____"],
       paint:{"line-color":"#de6f17","line-width":3}},
     ]},
   });
   mapRef.current=map;
   map.addControl(new maplibregl.NavigationControl({showCompass:false}),"top-right");
   map.on("load",()=>{
     if(dead)return;
     const bbox=new LngLatBounds([header.minLon,header.minLat],[header.maxLon,header.maxLat]);
     if(!bbox.isEmpty())map!.fitBounds(bbox,{padding:22,duration:0,maxZoom:13});
     setMapReady(true);
   });
   map.on("click","hex-fill",(e)=>{
     const c=e.features?.[0]?.properties?.cell;
     if(typeof c!=="string")return;
     setSelected(c);
     const st=current.current;
     const cell=st?.cells.find(x=>x.cell===c);
     if(!cell||!st||!map)return;
     const root=document.createElement("div");
     const strong=document.createElement("strong");strong.textContent="Grade "+c;root.append(strong);
     add(root,"Valor selecionado",fmt(numberIn(cell,st.metric)));
     add(root,"Endereços não domiciliares",fmt(numberIn(cell,"n")));
     add(root,"Coordenadas de maior qualidade",fmt(numberIn(cell,"n_high")));
     add(root,"Área recortada",n2.format(cell.a_km2)+" km²");
     add(root,"Referência","CNEFE/IBGE 2022");
     new maplibregl.Popup({maxWidth:"275px"}).setLngLat(e.lngLat).setDOMContent(root).addTo(map);
   });
   map.on("mouseenter","hex-fill",()=>{if(map)map.getCanvas().style.cursor="pointer"});
   map.on("mouseleave","hex-fill",()=>{if(map)map.getCanvas().style.cursor=""});
   map.on("error",e=>{const message=String(e.error?.message||"");if(!dead&&/PMTiles|hex500|heat500|source-layer/i.test(message))setMapError(message)});
  })().catch(e=>{if(!dead)setMapError(String(e))});
  return ()=>{dead=true;map?.remove();if(registered)maplibregl.removeProtocol("pmtiles");mapRef.current=null};
 },[data]);
 useEffect(()=>{
  const map=mapRef.current;
  if(!map||!mapReady)return;
  map.setLayoutProperty("hex-fill","visibility","visible");
  map.setPaintProperty("hex-fill","fill-color",expression(metric,thresholds));
  map.setPaintProperty("hex-fill","fill-opacity",mode==="hex"?.78:.015);
  map.setLayoutProperty("hex-line","visibility",mode==="hex"?"visible":"none");
  map.setLayoutProperty("heat","visibility",mode==="heat"?"visible":"none");
  map.setFilter("selected-hex",["==",["get","cell"],selected||"____"]);
  if(mode==="heat"){
    const key=metric==="cnpj"?"cw":metric.startsWith("k")?"h"+metric:"w";
    map.setFilter("heat",[">=",["coalesce",["get",key],0],5]);
    map.setPaintProperty("heat","heatmap-weight",["interpolate",["linear"],
      ["to-number",["get",key],0],5,.16,100,1] as ExpressionSpecification);
  }
 },[mode,metric,thresholds,mapReady,selected]);
 useEffect(()=>{const map=mapRef.current;if(map&&mapReady)map.setLayoutProperty("osm","visibility",osm?"visible":"none")},[osm,mapReady]);
 return <main className="mx-auto max-w-[1540px] space-y-5 px-4 pb-16 pt-8 text-ink sm:px-6">
  <Link href="/bairros" className="text-sm font-semibold text-brand-700">← Mapa econômico de bairros</Link>
  <header className="flex flex-wrap items-end justify-between gap-3">
   <div className="max-w-4xl">
    <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700"><Hexagon size={15}/> Hexágonos 500 m · IBGE CNEFE 2022 · PMTiles</span>
    <h1 className="mt-3 text-2xl font-extrabold sm:text-4xl">Concentração territorial de estabelecimentos</h1>
    <p className="mt-3 text-sm leading-relaxed text-slate-600">Grade hexagonal de 500 m e calor estatístico calculados a partir de endereços não domiciliares georreferenciados do IBGE. CNPJs com endereço exatamente conciliado só aparecem como agregado, quando a base correspondente estiver disponível.</p>
   </div>
   {data?.status==="verified"&&<button onClick={()=>csvExport(data,cells,metric)} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white"><Download size={16}/> Exportar CSV</button>}
  </header>
  {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
  {data?.status==="not_loaded"&&<p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">A coleta CNEFE e a geração dos hexágonos estão em validação; não há grade sintética ou contagens imputadas.</p>}
  {!data&&!error&&<p className="text-sm text-slate-600">Carregando indicadores e metadados do IBGE...</p>}
  {data?.status==="verified"&&data.coverage&&<>
   <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {[
     ["Endereços observados",num.format(data.coverage.nonResidentialWithCoordinatesInOfficialBairros),"CNEFE · espécies não domiciliares"],
     ["Hexágonos cartografados",num.format(data.coverage.gridCells),"500 metros entre faces"],
     ["Células de calor",num.format(data.coverage.heatCellsAtLeastFiveHighQualityAddresses),"≥5 coordenadas qualidade 1–2"],
     ["Fora dos limites de bairros",num.format(data.coverage.notInOfficialBairros),"Registros não distribuídos artificialmente"],
    ].map(([label,val,note])=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
     <p className="text-xs font-bold uppercase leading-relaxed text-slate-500">{label}</p>
     <p className="mt-2 text-2xl font-extrabold tabular-nums sm:text-3xl">{val}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">{note}</p>
    </div>)}
   </section>
   {data.cnpjMatch&&<div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-xs leading-relaxed text-brand-900"><strong>Cruzamento CNPJ × CNEFE:</strong> {num.format(data.cnpjMatch.matched)} estabelecimentos ativos da Receita Federal, referência {data.cnpjReference}, associados por CEP, logradouro e número a endereço não domiciliar CNEFE de qualidade 1–2 ({n2.format(data.cnpjMatch.matchedPercent)}% de {num.format(data.cnpjMatch.active)} ativos). As demais empresas continuam sem geocodificação verificada; a cobertura é parcial e não deve representar todo o mercado.</div>}
   <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
    <div className="text-xs font-bold text-slate-600">Visualização
     <div className="mt-2 flex gap-2">
      <button onClick={()=>setMode("hex")} className={"flex flex-1 items-center justify-center gap-1 rounded-xl px-3 py-2.5 text-xs font-semibold "+(mode==="hex"?"bg-brand-600 text-white":"bg-slate-100 text-slate-600")}><Layers3 size={14}/> Hexágonos</button>
      <button onClick={()=>setMode("heat")} className={"flex flex-1 items-center justify-center gap-1 rounded-xl px-3 py-2.5 text-xs font-semibold "+(mode==="heat"?"bg-brand-600 text-white":"bg-slate-100 text-slate-600")}><Flame size={14}/> Calor</button>
     </div>
    </div>
    <label className="text-xs font-bold text-slate-600">Variável
     <select value={metric} onChange={e=>{setMetric(e.target.value as Metric);setSelected("")}} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal">
      {metrics.filter(m=>m.id!=="cnpj"||data.cnpjMatch).map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
     </select>
    </label>
    <label className="text-xs font-bold text-slate-600">Base cartográfica
     <select value={osm?"osm":"off"} onChange={e=>setOsm(e.target.value==="osm")} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal">
      <option value="osm">OSM e bairros oficiais</option><option value="off">Bairros oficiais sem ruas</option>
     </select>
    </label>
   </section>
   <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_325px]">
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-card sm:p-4">
     <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><MapPin size={16}/> {mode==="heat"?"Mapa de calor das células":"Densidade por hexágono"} · {metricLabel}</h2>
     <div className="relative">
      <div ref={canvas} className="h-[410px] overflow-hidden rounded-xl bg-slate-100 sm:h-[590px]" role="region" aria-label="Mapa PMTiles hexágonos 500m, CNEFE Canoas"/>
      {!mapReady&&!mapError&&<div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-semibold text-slate-600">Carregando camada de hexágonos PMTiles…</div>}
      {mapError&&<div role="alert" className="absolute inset-0 flex items-center justify-center bg-white/90 p-5 text-center text-sm text-amber-800">Erro ao carregar o mapa: {mapError}</div>}
     </div>
     {mode==="hex"?<div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
      <span className="inline-flex items-center gap-1"><span className="h-3 w-4 rounded bg-slate-200"/> N/D, contagem 1–4 suprimida</span>
      {C.map((c,i)=><span key={i} className="inline-flex items-center gap-1"><span className="h-3 w-4 rounded" style={{backgroundColor:c}}/>{i===0?"Menor":i===4?"Maior":""}</span>)}
     </div>:<p className="mt-3 text-xs leading-relaxed text-amber-900">O calor usa os <strong>centros dos hexágonos ponderados</strong> pelas contagens com coordenadas de maior qualidade; esses centros não são localizações individuais de empresas ou endereços. É uma superfície suavizada de intensidade espacial.</p>}
     {metric==="cnpj"&&<p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Esta camada corresponde apenas a CNPJs cujo endereço cadastral foi conciliado exatamente a endereço não domiciliar do CNEFE 2022. O calor pondera centros de hexágonos, não divulga pontos nem substitui o total municipal de CNPJs.</p>}
     {metric.startsWith("k")&&<p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Categorias do CNEFE representam espécies de endereço, não setores CNAE. O mapa de calor considera somente observações de melhor qualidade geográfica para esta espécie.</p>}
    </div>
    <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
     <h2 className="font-bold">Células mais concentradas</h2><p className="mt-1 text-xs text-slate-500">{num.format(ranking.length)} hexágonos com valor publicável na variável selecionada.</p>
     <label className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} className="min-w-0 flex-1 text-xs outline-none" placeholder="Filtrar identificador de grade" aria-label="Filtrar hexágonos"/></label>
     <div className="mt-3 max-h-[495px] space-y-1 overflow-auto">
      {ranking.filter(c=>c.cell.toLowerCase().includes(search.toLowerCase())).slice(0,120).map((c,i)=><button key={c.cell} onClick={()=>{setSelected(c.cell);mapRef.current?.flyTo({center:[c.lon,c.lat],zoom:14.2})}}
        className={"flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left "+(selected===c.cell?"border-brand-600 bg-brand-50":"border-slate-100 bg-slate-50 hover:border-brand-200")}>
        <span className="text-xs text-slate-600">{i+1}. {c.cell}</span><strong className="text-sm tabular-nums">{fmt(numberIn(c,metric))}</strong>
      </button>)}
     </div>
     {highlight&&<div className="mt-3 rounded-xl bg-brand-50 p-3 text-xs leading-relaxed">
      <p><strong>{highlight.cell}</strong></p><p>Endereços registrados: {fmt(numberIn(highlight,"n"))}</p><p>Maior qualidade geográfica: {fmt(numberIn(highlight,"n_high"))}</p>
      <p>Área recortada: {n2.format(highlight.a_km2)} km²</p>
     </div>}
    </aside>
   </section>
   <section className="grid gap-4 lg:grid-cols-2">
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
     <h2 className="flex items-center gap-2 text-sm font-bold"><ShieldCheck size={16}/> Qualidade das coordenadas IBGE</h2>
     <div className="mt-3 space-y-2 text-xs">
      {Object.entries(data.coverage.geocodingLevelCounts).map(([code,count])=><div className="flex items-center justify-between border-b border-slate-100 pb-2" key={code}><span>Nível {code} · {({1:"Original",2:"Ajustada",3:"Estimada",4:"Face de quadra",5:"Localidade",6:"Setor censitário"} as Record<string,string>)[code]||"Classificação IBGE"}</span><strong>{num.format(count)}</strong></div>)}
     </div>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
     <h2 className="flex items-center gap-2 text-sm font-bold"><Info size={16}/> Interpretação e fontes</h2>
     <p className="mt-2 text-xs leading-relaxed text-slate-600">Dados de endereços: <a href="https://www.ibge.gov.br/estatisticas/sociais/populacao/38734-cadastro-nacional-de-enderecos-para-finsestatisticos.html" target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">IBGE CNEFE 2022 <ExternalLink size={11} className="inline"/></a>. Limites de bairros: GeoCanoas (Prefeitura de Canoas). Grade de 500 m em SIRGAS 2000/UTM 22S.</p>
     <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-slate-600">{(data.notes||[]).map((t,i)=><li key={i}>{t}</li>)}</ul>
    </div>
   </section>
  </>}
 </main>;
}
