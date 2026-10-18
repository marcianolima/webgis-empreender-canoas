"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {ResponsiveContainer,LineChart,Line,BarChart,Bar,XAxis,YAxis,Tooltip,CartesianGrid,Legend} from "recharts";
import {Download,ExternalLink,Play,Search,ShieldCheck} from "lucide-react";
import type {SebraeSeriesCatalog,SebraeSeriesDocument} from "@/types/sebrae-series";

const base=process.env.NEXT_PUBLIC_BASE_PATH||"";
const API="https://apiv2-observatorio.sebrae.com.br/tesseract";
const num=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2});
const fmt=(v:unknown)=>typeof v==="number"?num.format(v):String(v??"");
const colors=["#087f66","#247f96","#b27a34","#596a91","#94729a"];
const MONTH:Record<string,number>={janeiro:1,fevereiro:2,março:3,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12};
const COUNT=/workers|establishments|admissions|resignations|enrollments|population|students|attendances|agencies|stations|empregos|matrículas|total deaths|total births/i;
const GEO=/^Municipality$|^Country$|^Region$|^State$|Mesoregion|Microregion|Sebrae|ELI|Project Leader|Biome/;
type Row=Record<string,string|number|null>;
type Member={key:string|number;caption:string};
type Result={rows:Row[];url:string;dimension:string[];measure:string;total:number;suppressed:number;timestamp:string;years:string;cube:string};

function safeCsv(value:unknown):string{
 const s=String(value??"");
 const numeric=/^[+-]?(?:\d+(?:\.\d+)?|\d{1,3}(?:\.\d{3})+(?:,\d+)?)$/.test(s);
 const safe=!numeric&&/^[=+\-@\t\r]/.test(s)?"'"+s:s;
 return '"'+safe.replaceAll('"','""')+'"';
}
function exportResult(result:Result){
 const keys=["ibge","cubo","filtros_aplicados","consulta_em",...result.dimension,result.measure];
 const rows=[keys,...result.rows.map(r=>["4304606",result.cube,result.url,result.timestamp,...result.dimension.map(d=>String(r[d]??"")),String(r[result.measure]??"")])];
 const csv="\ufeff"+rows.map(r=>r.map(safeCsv).join(";")).join("\r\n");
 const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
 const a=document.createElement("a");a.href=url;a.download="sebrae-consulta-canoas-"+result.cube.replaceAll(/[^a-zA-Z0-9_-]/g,"_")+".csv";a.click();URL.revokeObjectURL(url);
}
export function SebraeLiveQuery(){
 const [catalog,setCatalog]=useState<SebraeSeriesCatalog[]>([]);
 const [status,setStatus]=useState("Carregando catálogo público já validado…");
 const [cube,setCube]=useState("RAIS_workers");
 const [search,setSearch]=useState("");
 const [metric,setMetric]=useState("");
 const [axis,setAxis]=useState("");
 const [compare,setCompare]=useState("none");
 const [years,setYears]=useState("");
 const [extraDim,setExtraDim]=useState("");
 const [extraValue,setExtraValue]=useState("");
 const [members,setMembers]=useState<Member[]>([]);
 const [membersLoading,setMembersLoading]=useState(false);
 const [advancedFilters,setAdvancedFilters]=useState<{dim:string;value:string;caption:string}[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [result,setResult]=useState<Result|null>(null);
 const [bar,setBar]=useState(false);
 const [viewAll,setViewAll]=useState(false);
 const [singleGroup,setSingleGroup]=useState("__top");
 useEffect(()=>{
  const controller=new AbortController();
  fetch(base+"/data/sebrae-series.json",{signal:controller.signal})
   .then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json();})
   .then((d:SebraeSeriesDocument)=>{
    if(d.municipalityIbgeCode!=="4304606"||d.catalog.length<80)throw Error("Catálogo municipal inválido");
    setCatalog(d.catalog);setStatus("Catálogo carregado e validado");
   }).catch(e=>{if(e.name!=="AbortError")setStatus("Catálogo indisponível: "+String(e));});
  return ()=>controller.abort();
 },[]);
 const cubeMeta=catalog.find(c=>c.name===cube);
 const metricValue=cubeMeta?.measures.includes(metric)?metric:cubeMeta?.measures[0]||"";
 const dims=(cubeMeta?.dimensions||[]).filter(d=>!GEO.test(d)&&d!=="Municipality");
 const defaultAxis=dims.includes("Year")?"Year":dims.includes("Open Activity Year")?"Open Activity Year":dims[0]||"";
 const axisValue=dims.includes(axis)?axis:defaultAxis;
 const groupValue=compare!=="none"&&dims.includes(compare)&&compare!==axisValue?compare:"none";
 const filterable=dims.filter(d=>d!==axisValue&&d!==groupValue&&d!=="Year"
  &&!(cube==="RAIS_workers"&&d==="Active worker indicator")
  &&!(cube==="RF"&&d==="Registration Status"));
 const chosenExtra=filterable.includes(extraDim)?extraDim:filterable[0]||"";
 const allowed=catalog.filter(c=>c.hasMunicipality&&(!search||((c.name+" "+c.source).toLowerCase().includes(search.toLowerCase()))));
 const grouped=groupValue!=="none"&&result?Array.from(new Set(result.rows.map(x=>String(x[groupValue]??"")))):[];
 const selectedGroups=groupValue==="none"?["Total"]:singleGroup!=="__top"&&grouped.includes(singleGroup)?[singleGroup]:grouped.slice(0,5);
 const plot=new Map<string,Record<string|number,string|number|null>>();
 const isMonth=result?.dimension.includes("Month")&&result?.dimension.includes("Year");
 if(result){
  for(const r of result.rows){
   let x=String(r[axisValue]??"—");
   if(isMonth&&axisValue==="Year"){
    const m=String(r.Month??"");
    const month=MONTH[m.toLocaleLowerCase("pt-BR")]||Number(m)||0;
    x=String(r.Year)+"-"+String(month).padStart(2,"0");
   }
   const group=groupValue==="none"?"Total":String(r[groupValue]??"");
   if(!selectedGroups.includes(group))continue;
   if(!plot.has(x))plot.set(x,{period:x});
   const k="v"+selectedGroups.indexOf(group);
   const raw=r[result.measure];
   const n=typeof raw==="number"?raw:null;
   if(plot.get(x)![k]===undefined)plot.get(x)![k]=n;
  }
 }
 const chronological=axisValue==="Year"||axisValue==="Open Activity Year"||axisValue==="Month"||isMonth;
 const chart=Array.from(plot.values()).sort((a,b)=>{
  if(chronological)return String(a.period).localeCompare(String(b.period),"pt-BR",{numeric:true});
  return Number(b.v0||0)-Number(a.v0||0);
 }).slice(chronological&&!viewAll?-90:0,viewAll?undefined:chronological?undefined:80);
 const lineDefs=selectedGroups.map((label,i)=>({key:"v"+i,label,color:colors[i%colors.length]}));

 function chooseCube(name:string){
  setCube(name);setMetric("");setAxis("");setCompare("none");setYears("");setExtraDim("");
  setAdvancedFilters([]);setMembers([]);setExtraValue("");setResult(null);setError("");
 }
 async function loadMembers(){
  if(!cubeMeta||!chosenExtra)return;
  setMembersLoading(true);setError("");
  try{
   const url=API+"/members?"+new URLSearchParams({cube,level:chosenExtra}).toString();
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),20000);
   let resp:Response;
   try{resp=await fetch(url,{signal:controller.signal,mode:"cors"});}finally{clearTimeout(timer);}
   if(!resp.ok)throw Error("HTTP "+resp.status);
   const data=await resp.json();
   const list=Array.isArray(data.members)?data.members:Array.isArray(data.data)?data.data:[];
   const options=list.filter((r:Record<string,unknown>)=>r&&r.key!==undefined)
      .slice(0,1000).map((r:Record<string,unknown>)=>({key:String(r.key),caption:String(r.caption??r.key)}));
   setMembers(options);setExtraValue(options[0]?.key||"");
   if(!options.length)throw Error("Sem categorias enumeráveis para essa dimensão");
  }catch(e){setError("Não foi possível enumerar membros: "+String(e));setMembers([]);}
  finally{setMembersLoading(false);}
 }
 function addFilter(){
  if(!chosenExtra||!extraValue)return;
  const caption=members.find(m=>String(m.key)===extraValue)?.caption||extraValue;
  setAdvancedFilters(p=>[...p.filter(x=>x.dim!==chosenExtra),{dim:chosenExtra,value:extraValue,caption}]);
 }
 async function run(){
  setResult(null);setError("");
  if(!cubeMeta?.hasMunicipality||!axisValue||!metricValue){setError("Escolha um cubo municipal, eixo e medida.");return;}
  if(years.trim()&&!/^(19|20)\d{2}(,(19|20)\d{2})*$/.test(years.trim())){setError("Informe anos como 2024 ou 2024,2025.");return;}
  if(years.trim()&&!dims.includes("Year")){setError("Este cubo não disponibiliza a dimensão Ano (Year); deixe o filtro de anos vazio.");return;}
  const drilldowns=[axisValue];
  if(axisValue==="Year"&&dims.includes("Month"))drilldowns.push("Month");
  if(groupValue!=="none"&&!drilldowns.includes(groupValue))drilldowns.push(groupValue);
  const params=new URLSearchParams();
  params.set("cube",cube);params.set("drilldowns",drilldowns.join(","));
  params.set("measures",metricValue);params.set("Municipality","4304606");params.set("parents","false");params.set("limit","3000");
  if(cube==="RAIS_workers")params.set("Active worker indicator","1");
  if(cube==="RF")params.set("Registration Status","2");
  if(years.trim()&&dims.includes("Year")&&!drilldowns.includes("Year"))params.set("Year",years.trim());
  if(years.trim()&&axisValue==="Year")params.set("Year",years.trim());
  for(const f of advancedFilters)if(!drilldowns.includes(f.dim)&&f.dim!=="Municipality")params.set(f.dim,f.value);
  const url=API+"/data.jsonrecords?"+params.toString();
  setBusy(true);
  try{
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),35000);
   let response:Response;
   try{response=await fetch(url,{mode:"cors",signal:controller.signal,headers:{Accept:"application/json"}});}finally{clearTimeout(timer);}
   if(!response.ok)throw Error("HTTP "+response.status);
   const payload=await response.json();
   const original=payload?.data;
   if(!Array.isArray(original))throw Error("Estrutura de retorno não reconhecida");
   const total=Number(payload?.page?.total??original.length);
   if(total>3000||original.length>3000)throw Error("Resultado possui "+total+" linhas. Refine as dimensões ou o ano para obter cobertura integral.");
   const arr:Row[]=[];
   let suppressed=0;
   for(const raw of original){
    if(!raw||typeof raw!=="object")continue;
    const r:Row={};
    let valid=true;
    for(const dim of drilldowns){
     if(typeof raw[dim]!=="string"&&typeof raw[dim]!=="number"){valid=false;break;}
     r[dim]=raw[dim];
    }
    if(!valid)continue;
    const value=raw[metricValue];
    if(value!==null&&typeof value==="number"&&Number.isFinite(value)){
     if(COUNT.test(metricValue)&&value>0&&value<5){r[metricValue]=null;suppressed++;}
     else r[metricValue]=value;
    }else r[metricValue]=null;
    arr.push(r);
   }
   if(!arr.length)throw Error("A consulta não retornou observações municipais válidas. Não interpretar como zero.");
   setResult({rows:arr,url,dimension:drilldowns,measure:metricValue,total,suppressed,
    timestamp:new Date().toISOString(),years:years.trim(),cube});
  }catch(e){setError("Consulta não concluída: "+String(e));}
  finally{setBusy(false);}
 }
 return <main className="mx-auto max-w-[1450px] space-y-6 px-4 pb-16 pt-8 text-ink sm:px-6">
  <Link href="/sebrae/series" className="text-sm font-semibold text-brand-700">← Séries municipais armazenadas</Link>
  <header className="max-w-4xl space-y-3">
   <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700"><ShieldCheck size={15}/> Consulta pública anônima · Municipal IBGE 4304606</span>
   <h1 className="text-2xl font-extrabold sm:text-4xl">Consultas multidimensionais avançadas</h1>
   <p className="text-sm leading-relaxed text-slate-600">Explore combinações adicionais de medidas e dimensões diretamente na API pública do Sebrae. O município permanece fixo em Canoas. Consultas executadas aqui são resultados ao vivo, não séries previamente homologadas e armazenadas.</p>
  </header>
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
   <p className="text-xs font-medium text-slate-500">{status}</p>
   <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    <label className="block text-xs font-bold text-slate-600">Buscar cubo público
     <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ex.: RAIS, CAGED, REDESIM" className="min-w-0 flex-1 text-sm font-normal outline-none"/></div>
    </label>
    <label className="block text-xs font-bold text-slate-600">Cubo de origem
     <select value={cube} onChange={e=>chooseCube(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal">
      {allowed.map(m=><option key={m.name} value={m.name}>{m.caption}</option>)}
      {!allowed.some(m=>m.name===cube)&&cubeMeta&&<option value={cube}>{cubeMeta.caption}</option>}
     </select>
    </label>
    <label className="block text-xs font-bold text-slate-600">Medida agregada
     <select value={metricValue} onChange={e=>{setMetric(e.target.value);setResult(null);}} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal">{cubeMeta?.measures.map(m=><option key={m} value={m}>{m}</option>)}</select>
    </label>
    <label className="block text-xs font-bold text-slate-600">Eixo horizontal
     <select value={axisValue} onChange={e=>{setAxis(e.target.value);setCompare("none");setAdvancedFilters([]);setResult(null);}} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal">
      {dims.map(m=><option key={m} value={m}>{m}</option>)}
     </select>
    </label>
    <label className="block text-xs font-bold text-slate-600">Comparar categorias
     <select value={groupValue} onChange={e=>{setCompare(e.target.value);setAdvancedFilters([]);setResult(null);}} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal">
      <option value="none">Sem segundo agrupamento</option>{dims.filter(m=>m!==axisValue&&m!=="Month").map(m=><option key={m} value={m}>{m}</option>)}
     </select>
    </label>
    <label className="block text-xs font-bold text-slate-600">Anos (se a dimensão Year existir)
     <input value={years} onChange={e=>setYears(e.target.value)} placeholder="Ex.: 2024,2025" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal"/>
    </label>
   </div>
   <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <h2 className="text-sm font-bold">Adicionar filtro por membro da dimensão</h2>
    <p className="mt-1 text-xs text-slate-500">Use filtros adicionais para reduzir resultados volumosos e evitar combinações incomparáveis.</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
     <select value={chosenExtra} onChange={e=>{setExtraDim(e.target.value);setMembers([]);setExtraValue("");}} className="min-w-0 rounded-xl border border-slate-200 bg-white p-2.5 text-xs">
      {filterable.map(m=><option key={m} value={m}>{m}</option>)}
      {!filterable.length&&<option value="">Nenhuma dimensão extra</option>}
     </select>
     <select value={extraValue} onChange={e=>setExtraValue(e.target.value)} className="min-w-0 rounded-xl border border-slate-200 bg-white p-2.5 text-xs" disabled={!members.length}>
      {members.map(m=><option key={String(m.key)} value={String(m.key)}>{m.caption}</option>)}
      {!members.length&&<option value="">Carregue as categorias</option>}
     </select>
     <div className="flex gap-2"><button disabled={!chosenExtra||membersLoading} onClick={loadMembers} className="rounded-xl border border-brand-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50">{membersLoading?"Carregando":"Categorias"}</button>
      <button disabled={!extraValue} onClick={addFilter} className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Adicionar</button></div>
    </div>
    {!!advancedFilters.length&&<div className="mt-3 flex flex-wrap gap-2">{advancedFilters.map(f=><button key={f.dim} onClick={()=>setAdvancedFilters(x=>x.filter(v=>v.dim!==f.dim))} className="rounded-lg bg-white px-3 py-2 text-xs text-brand-800">{f.dim}: {f.caption} ×</button>)}</div>}
   </div>
   {cube==="RAIS_workers"&&<p className="mt-3 rounded-xl bg-brand-50 p-3 text-xs text-brand-900">Filtro padrão ativo: vínculos ativos na RAIS, necessário para reproduzir o total de 95.355 em Canoas em 2025.</p>}
   {cube==="RF"&&<p className="mt-3 rounded-xl bg-brand-50 p-3 text-xs text-brand-900">Filtro padrão ativo: situação cadastral 02 (ativa). Outras situações estão documentadas nas séries armazenadas.</p>}
   <button disabled={busy||!cubeMeta?.hasMunicipality} onClick={run} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-40"><Play size={15}/>{busy?"Consultando fonte pública…":"Executar consulta municipal"}</button>
  </section>
  {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
  {result&&<section className="space-y-4">
   <div className="flex flex-wrap items-center justify-between gap-3"><div>
    <h2 className="text-lg font-bold">Resultado — {result.cube}</h2>
    <p className="mt-1 text-xs text-slate-600">{result.total} linhas recebidas · {result.suppressed} células pequenas suprimidas · consulta em {new Date(result.timestamp).toLocaleString("pt-BR")}</p></div>
    <button onClick={()=>exportResult(result)} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white"><Download size={16}/> CSV completo</button>
   </div>
   <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
     <p className="text-xs text-slate-600">Medida: <strong>{result.measure}</strong> · filtrado para Canoas, RS</p>
     <div className="flex gap-3 text-xs">
      <label className="flex items-center gap-2"><input type="checkbox" checked={bar} onChange={e=>setBar(e.target.checked)}/> Barras</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={viewAll} onChange={e=>setViewAll(e.target.checked)}/> Todos os períodos</label>
     </div>
    </div>
    {!!grouped.length&&<label className="mb-4 block max-w-sm text-xs font-semibold">Comparar
     <select value={singleGroup} onChange={e=>setSingleGroup(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs"><option value="__top">Primeiras 5 categorias</option>{grouped.map(g=><option key={g} value={g}>{g}</option>)}</select>
    </label>}
    {chart.length>0?<div className="h-[360px] w-full" role="img" aria-label="Série obtida em consulta pública ao Sebrae">
     <ResponsiveContainer width="100%" height="100%">
      {bar?<BarChart data={chart} margin={{bottom:40,right:10,left:-10}}>
       <CartesianGrid vertical={false} stroke="#e6ebef"/><XAxis dataKey="period" tick={{fontSize:10}} minTickGap={16} angle={-22} textAnchor="end" height={60}/><YAxis width={66} tick={{fontSize:10}}/><Tooltip formatter={v=>fmt(v)}/><Legend wrapperStyle={{fontSize:11}}/>{lineDefs.map(p=><Bar key={p.key} dataKey={p.key} name={p.label} fill={p.color}/>)}
      </BarChart>:<LineChart data={chart} margin={{bottom:40,right:10,left:-10}}>
       <CartesianGrid vertical={false} stroke="#e6ebef"/><XAxis dataKey="period" tick={{fontSize:10}} minTickGap={16} angle={-22} textAnchor="end" height={60}/><YAxis width={66} tick={{fontSize:10}}/><Tooltip formatter={v=>fmt(v)}/><Legend wrapperStyle={{fontSize:11}}/>{lineDefs.map(p=><Line key={p.key} dataKey={p.key} name={p.label} stroke={p.color} strokeWidth={2.5} dot={false}/>)}
      </LineChart>}
     </ResponsiveContainer>
    </div>:<p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">Não existem valores numéricos publicáveis para esta seleção.</p>}
    <p className="mt-3 text-xs text-amber-900">Médias, índices e taxas nunca são somados entre categorias. Para cruzamentos multidimensionais, selecione recortes específicos. Resultados atuais não são armazenados automaticamente no repositório.</p>
    <a href={result.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-brand-700 underline">Ver JSON da API pública <ExternalLink size={14}/></a>
   </div>
   <div className="rounded-2xl border border-slate-200 bg-white p-5">
    <h3 className="text-sm font-bold">Registros originais da consulta</h3>
    <p className="mt-1 text-xs text-slate-500">Primeiros 100 registros; exporte o CSV para obter todos os {result.rows.length}.</p>
    <div className="mt-4 max-h-[450px] overflow-auto"><table className="min-w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50"><tr>{[...result.dimension,result.measure].map(c=><th key={c} className="whitespace-nowrap border-b px-3 py-2.5">{c}</th>)}</tr></thead>
     <tbody>{result.rows.slice(0,100).map((r,i)=><tr key={i} className="border-b border-slate-100">{[...result.dimension,result.measure].map(c=><td key={c} className="whitespace-nowrap px-3 py-2">{fmt(r[c])}</td>)}</tr>)}</tbody>
    </table></div>
   </div>
  </section>}
  <p className="text-xs leading-relaxed text-slate-600">A consulta funciona no navegador via API pública com CORS autorizado e mantém somente agregados por município. Os históricos mensais homologados continuam em <Link href="/sebrae/series" className="font-semibold text-brand-700 underline">Séries armazenadas</Link>, coletados no GitHub Actions e acessíveis mesmo se a API estiver temporariamente indisponível.</p>
 </main>;
}
