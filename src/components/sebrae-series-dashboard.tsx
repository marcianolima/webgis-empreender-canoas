"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {Bar,BarChart,CartesianGrid,Legend,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import {Activity,ArrowUpRight,BookOpen,Download,ExternalLink,Filter,Search} from "lucide-react";
import type {SebraeSeriesDataset,SebraeSeriesDocument,SeriesRow} from "@/types/sebrae-series";

const base=process.env.NEXT_PUBLIC_BASE_PATH||"";
const SOURCE="https://observatorio.sebrae.com.br/profile/geo/canoas";
const GROUPS=[
  ["empresas","Empresas e formalização"],["emprego","Mercado de trabalho"],
  ["ocupacoes","Profissões e ocupações"],["comercio","Comércio e turismo"],
  ["financas","Finanças e orçamento"],["educacao","Educação e qualificação"],
  ["demografia","População e consumo"],["desenvolvimento","Desenvolvimento"],
  ["agro","Agropecuária"],
] as const;
const colors=["#087f66","#247f96","#bb7b31","#586e85","#866f9c"];
const number=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2});
const integer=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:0});
const real=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:2});
const usd=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"USD",maximumFractionDigits:0});
const MONTHS:Record<string,number>={
 janeiro:1,fevereiro:2,marco:3,março:3,abril:4,maio:5,junho:6,julho:7,agosto:8,
 setembro:9,outubro:10,novembro:11,dezembro:12,january:1,february:2,march:3,april:4,may:5,june:6,
 july:7,august:8,september:9,october:10,november:11,december:12
};
function asNumber(v:unknown):number|null{
 if(typeof v==="number"&&Number.isFinite(v))return v;
 if(typeof v==="string"&&v.trim()!==""&&Number.isFinite(Number(v)))return Number(v);
 return null;
}
function measureFmt(n:number,metric:string):string{
 if(/dollar|fob/i.test(metric))return usd.format(n);
 if(/revenue|expense|salary|remuneration|tariff|income value|credit operation|asset availability|costing value|investiment value|valor|massa salarial/i.test(metric))return real.format(n);
 if(/rate|index|ratio|gini|idhm|ibc|pontua|score|percent|opening time|hours/i.test(metric))return number.format(n);
 return integer.format(n);
}
function periods(row:SeriesRow,axis:string):string{
 if(axis==="__month"){
  const year=String(row.Year??"");
  const raw=String(row.Month??"");
  const found=MONTHS[raw.toLocaleLowerCase("pt-BR")]??(Number.isFinite(Number(raw))?Number(raw):0);
  const m=found>=1&&found<=12?String(found).padStart(2,"0"):raw;
  return year+"-"+m;
 }
 return String(row[axis]??"—");
}
function safeCsv(value:unknown):string{
 const text=String(value??"");
 const numeric=/^[+-]?(?:\d+(?:\.\d+)?|\d{1,3}(?:\.\d{3})+(?:,\d+)?)$/.test(text);
 const protectedText=!numeric&&/^[=+\-@\t\r]/.test(text)?"'"+text:text;
 return '"'+protectedText.replaceAll('"','""')+'"';
}
function saveCsv(dataset:SebraeSeriesDataset,rows:SeriesRow[]){
 const columns=["municipio_ibge","cubo","filtros_fixos","data_coleta",...dataset.dimensions,...(dataset.measures||[])];
 const preface=["4304606",dataset.cube,JSON.stringify(dataset.filters),dataset.lastSuccessAt||""];
 const body="\ufeff"+[columns,...rows.map(r=>[...preface,...dataset.dimensions.map(k=>String(r[k]??"")),...(dataset.measures||[]).map(k=>String(r[k]??""))])]
   .map(row=>row.map(safeCsv).join(";")).join("\r\n");
 const url=URL.createObjectURL(new Blob([body],{type:"text/csv;charset=utf-8"}));
 const a=document.createElement("a");a.href=url;a.download="canoas-sebrae-"+dataset.id+".csv";
 a.click();URL.revokeObjectURL(url);
}
export function SebraeSeriesDashboard(){
 const [doc,setDoc]=useState<SebraeSeriesDocument|null>(null);
 const [error,setError]=useState("");
 const [topic,setTopic]=useState("emprego");
 const [search,setSearch]=useState("");
 const [selected,setSelected]=useState("rais-trabalho-anual");
 const [measure,setMeasure]=useState("");
 const [axis,setAxis]=useState("");
 const [compareBy,setCompareBy]=useState("");
 const [category,setCategory]=useState("__top");
 const [filters,setFilters]=useState<Record<string,string>>({});
 const [chartType,setChartType]=useState<"line"|"bar">("line");
 const [chartLimit,setChartLimit]=useState("100");
 const [tableLimit,setTableLimit]=useState("45");
 const [showCatalog,setShowCatalog]=useState(false);
 const [catalogSearch,setCatalogSearch]=useState("");

 useEffect(()=>{
  const controller=new AbortController();
  fetch(base+"/data/sebrae-series.json",{cache:"no-store",signal:controller.signal})
   .then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json();})
   .then((x:SebraeSeriesDocument)=>{if(x.schemaVersion!==1||x.municipalityIbgeCode!=="4304606")throw Error("Dados fora do recorte municipal de Canoas");setDoc(x);})
   .catch(e=>{if(e.name!=="AbortError")setError(String(e));});
  return ()=>controller.abort();
 },[]);

 const list=doc?.datasets||[];
 const selectedSet=list.find(d=>d.id===selected);
 const available=selectedSet?.status==="ok"?(selectedSet.rows||[]):[];
 const dims=selectedSet?.dimensions||[];
 const measures=selectedSet?.measures||[];
 const chosenMeasure=measures.includes(measure)?measure:measures[0]||"";
 const hasYear=dims.includes("Year");
 const hasMonth=dims.includes("Month")&&hasYear;
 const defaultAxis=hasMonth?"__month":hasYear?"Year":dims.includes("Open Activity Year")?"Open Activity Year":dims[0]||"";
 const chosenAxis=axis==="__month"&&hasMonth?axis:(dims.includes(axis)?axis:defaultAxis);
 const otherDims=dims.filter(d=>d!==chosenAxis&&d!=="Month"&&d!=="Year");
 const preferredGroup=otherDims.find(x=>!/Registration Status|Operation Type ID|Administrative Type/i.test(x))||otherDims[0]||"";
 const chosenGroup=compareBy==="none"?"":otherDims.includes(compareBy)?compareBy:preferredGroup;
 const secondaryDims=dims.filter(d=>d!==chosenAxis&&d!==chosenGroup&&!(chosenAxis==="__month"&&(d==="Month"||d==="Year")));
 const distinct=(key:string)=>Array.from(new Set(available.map(row=>String(row[key]??"")).filter(x=>x!==""))).sort((a,b)=>a.localeCompare(b,"pt-BR",{numeric:true}));
 const selectedFilter=(key:string):string=>{
  const opts=distinct(key);
  if(filters[key]&&opts.includes(filters[key]))return filters[key];
  if(key==="Registration Status"&&opts.includes("Ativa"))return "Ativa";
  if(key==="Operation Type ID"&&opts.includes("Exportação"))return "Exportação";
  if(key==="Year"&&opts.length&&chosenAxis!=="__month")return opts[opts.length-1];
  if(key==="Administrative Type"&&opts.includes("Total"))return "Total";
  return opts[0]||"";
 };
 const filteredRows=available.filter(row=>secondaryDims.every(dim=>String(row[dim])===selectedFilter(dim)));
 const seriesGroups=chosenGroup?Array.from(new Set(filteredRows.map(row=>String(row[chosenGroup]??"—")))):[];
 const groupRank=seriesGroups.map(name=>({
  name,score:filteredRows.filter(row=>String(row[chosenGroup])===name)
   .reduce((sum,row)=>sum+Math.abs(asNumber(row[chosenMeasure])||0),0),
 })).sort((a,b)=>b.score-a.score);
 const chosenValues=chosenGroup?(category!=="__top"&&seriesGroups.includes(category)?[category]:groupRank.slice(0,5).map(x=>x.name)):["Total"];
 const chartSource=filteredRows.filter(row=>!chosenGroup||chosenValues.includes(String(row[chosenGroup])));
 const dataByX=new Map<string,Record<string,string|number|null>>();
 const categoryKeys=chosenValues.map((n,i)=>({name:n,key:"s"+i,color:colors[i%colors.length]}));
 let duplicateCells=0;
 for(const row of chartSource){
  const x=periods(row,chosenAxis);
  if(!dataByX.has(x))dataByX.set(x,{period:x});
  const name=chosenGroup?String(row[chosenGroup]):"Total";
  const series=categoryKeys.find(v=>v.name===name);
  if(!series)continue;
  const value=asNumber(row[chosenMeasure]);
  if(dataByX.get(x)![series.key]!==undefined)duplicateCells++;
  else dataByX.get(x)![series.key]=value;
 }
 const temporal=chosenAxis==="__month"||chosenAxis==="Year"||/Year$/.test(chosenAxis);
 const plotted=Array.from(dataByX.values()).sort((a,b)=>{
  const x=String(a.period),y=String(b.period);
  if(temporal)return x.localeCompare(y,"pt-BR",{numeric:true});
  const va=categoryKeys.reduce((v,k)=>v+Math.abs(asNumber(a[k.key])||0),0);
  const vb=categoryKeys.reduce((v,k)=>v+Math.abs(asNumber(b[k.key])||0),0);
  return vb-va;
 });
 const maximum=chartLimit==="all"?plotted.length:Number(chartLimit);
 const visual=temporal?plotted.slice(-maximum):plotted.slice(0,maximum);
 const tableRows=chartSource.slice(0,tableLimit==="all"?chartSource.length:Number(tableLimit));

 const visible=list.filter(d=>d.topic===topic&&(!search||((d.title+" "+d.cube+" "+d.id).toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")))));
 const catalog=(doc?.catalog||[]).filter(c=>!catalogSearch||((c.name+" "+c.source+" "+c.measures.join(" ")).toLowerCase().includes(catalogSearch.toLowerCase())));
 const filtersActive=secondaryDims.map(k=>({name:k,value:selectedFilter(k),choices:distinct(k)}));
 function pickDataset(d:SebraeSeriesDataset){
  setSelected(d.id);setMeasure("");setAxis("");setCompareBy("");setCategory("__top");setFilters({});setChartType("line");setShowCatalog(false);
 }
 function pickTopic(id:string){
  setTopic(id);setSearch("");
  const first=list.find(d=>d.topic===id&&d.status==="ok");
  if(first)pickDataset(first);
 }
 return <main className="mx-auto max-w-[1550px] space-y-6 px-4 pb-16 pt-8 text-ink sm:px-6">
  <Link href="/sebrae" className="text-sm font-semibold text-brand-700">← Panorama Sebrae</Link>
  <header className="flex flex-wrap items-end justify-between gap-4">
   <div className="max-w-4xl">
    <span className="inline-flex gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700"><Activity size={15}/> API pública OLAP · Canoas 4304606</span>
    <h1 className="mt-4 text-2xl font-extrabold sm:text-4xl">Explorador de séries históricas Sebrae</h1>
    <p className="mt-3 text-sm leading-relaxed text-slate-600">Séries municipais reproduzidas a partir dos cubos públicos: selecione tema, gráfico, indicador, período, atividade econômica e outras dimensões para analisar históricos e comparativos.</p>
   </div>
   <a href={SOURCE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-bold text-brand-700 underline">Perfil Sebrae original <ExternalLink size={14}/></a>
  </header>
  {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
  {!doc&&!error&&<p className="text-sm text-slate-500">Carregando catálogo e séries auditadas...</p>}
  {doc&&<>
   <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {[
     ["Cubos catalogados",doc.coverage.catalogCubes],
     ["Séries configuradas",doc.coverage.specifications],
     ["Séries com dados",doc.coverage.available],
     ["Registros agregados",doc.coverage.rows]
    ].map(([label,value])=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
     <p className="text-xs font-bold uppercase leading-relaxed text-slate-500">{label}</p>
     <p className="mt-2 text-2xl font-extrabold tabular-nums sm:text-3xl">{integer.format(Number(value))}</p>
    </div>)}
   </section>
   <div className="flex flex-wrap items-center gap-3">
    <button onClick={()=>setShowCatalog(false)} className={"rounded-xl px-4 py-2.5 text-sm font-bold "+(!showCatalog?"bg-brand-600 text-white":"bg-slate-100 text-slate-600")}>Explorar séries</button>
    <button onClick={()=>setShowCatalog(true)} className={"rounded-xl px-4 py-2.5 text-sm font-bold "+(showCatalog?"bg-brand-600 text-white":"bg-slate-100 text-slate-600")}>Catálogo completo de cubos</button>
    <span className="text-xs text-slate-500">Última coleta {doc.generatedAt?new Date(doc.generatedAt).toLocaleString("pt-BR"):"não publicada"}</span>
   </div>
   {showCatalog ? <section className="space-y-4">
    <p className="text-sm leading-relaxed text-slate-600">O catálogo contém os cubos identificados nos metadados públicos, inclusive os não reproduzidos nesta fotografia. Um cubo catalogado não comprova que todos os seus recortes tenham dados para Canoas.</p>
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3"><Search size={17}/><input value={catalogSearch} onChange={e=>setCatalogSearch(e.target.value)} className="min-w-0 flex-1 text-sm outline-none" placeholder="Buscar cubo, origem ou medida" aria-label="Buscar catálogo de cubos"/></label>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{catalog.map(c=><article key={c.name} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="break-all text-sm font-bold">{c.caption}</h3>
      <p className="mt-2 text-xs text-slate-500">Fonte: {c.source||"Conforme catálogo"}</p>
      <p className="mt-2 text-xs text-slate-600">{c.hasMunicipality?"Suporta município":"Sem recorte municipal no cubo"}</p>
      <p className="mt-2 line-clamp-3 text-xs text-slate-600"><strong>Medidas:</strong> {c.measures.join("; ")||"Sem medidas divulgadas"}</p>
      <p className="mt-2 text-xs text-slate-600">{c.dimensions.length} dimensões disponíveis</p>
      <p className="mt-1 text-xs text-slate-500">{list.filter(d=>d.cube===c.name&&d.status==="ok").length} séries verificadas neste observatório</p>
     </article>)}</div>
   </section> : <>
    <nav aria-label="Eixos do explorador" className="flex gap-2 overflow-x-auto pb-2">
     {GROUPS.map(([id,label])=><button key={id} onClick={e=>{pickTopic(id);e.currentTarget.scrollIntoView({behavior:"smooth",block:"nearest",inline:"start"});}}
      aria-current={topic===id?"page":undefined} className={"min-w-max shrink-0 rounded-xl border px-4 py-3 text-sm font-semibold "+(topic===id?"border-brand-600 bg-brand-50 text-brand-900":"border-slate-200 bg-white text-slate-600")}>{label}</button>)}
    </nav>
    <section className="grid min-w-0 gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
     <aside className="min-w-0 space-y-3">
      <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"><Search size={17} className="text-slate-400"/><input className="min-w-0 flex-1 text-sm outline-none" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar séries" aria-label="Buscar séries"/></label>
      <div className="max-h-[620px] space-y-2 overflow-y-auto">
       {visible.map(d=><button key={d.id} onClick={()=>pickDataset(d)} className={"w-full rounded-xl border p-3 text-left "+(selected===d.id?"border-brand-600 bg-brand-50":"border-slate-200 bg-white hover:bg-slate-50")}>
        <p className="text-sm font-semibold leading-relaxed">{d.title}</p>
        <p className="mt-1 text-xs text-slate-500">{d.cube} · {d.status==="ok"?integer.format(d.rowCount||0)+" registros":"Não disponível"}</p>
        {d.stale&&<p className="mt-1 text-xs text-amber-800">Última fotografia válida preservada</p>}
       </button>)}
      </div>
      {!visible.length&&<p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600">Nenhuma série localizada.</p>}
     </aside>
     <div className="min-w-0 space-y-4">
      {selectedSet ? <>
       <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
         <div><h2 className="text-lg font-extrabold">{selectedSet.title}</h2><p className="mt-2 text-xs text-slate-500">Cubo {selectedSet.cube} · {selectedSet.annotations?.source_name||"Origem conforme API"} · {selectedSet.rows?.length||0} registros</p></div>
         <button disabled={!available.length} onClick={()=>saveCsv(selectedSet,filteredRows)} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><Download size={15}/> CSV filtrado</button>
        </div>
        {selectedSet.status!=="ok"?<p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Série indisponível nesta coleta: {selectedSet.reason||"sem dados municipais suficientes"}. A ausência não foi interpretada como zero.</p>:<>
         <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="block text-xs font-bold text-slate-600">Medida
           <select value={chosenMeasure} onChange={e=>setMeasure(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal">{measures.map(m=><option key={m} value={m}>{m}</option>)}</select>
          </label>
          <label className="block text-xs font-bold text-slate-600">Eixo horizontal
           <select value={chosenAxis} onChange={e=>{setAxis(e.target.value);setCategory("__top");setFilters({});}} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal">
            {hasMonth&&<option value="__month">Ano-mês</option>}
            {dims.map(d=><option key={d} value={d}>{d}</option>)}
           </select>
          </label>
          <label className="block text-xs font-bold text-slate-600">Comparar por
           <select value={chosenGroup||"none"} onChange={e=>{setCompareBy(e.target.value);setCategory("__top");setFilters({});}} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal">
            <option value="none">Sem grupos</option>{otherDims.map(d=><option key={d} value={d}>{d}</option>)}
           </select>
          </label>
          {chosenGroup&&<label className="block text-xs font-bold text-slate-600">Categoria comparada
           <select value={category==="__top"||seriesGroups.includes(category)?category:"__top"} onChange={e=>setCategory(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal">
            <option value="__top">Comparar até 5 categorias</option>{groupRank.map(x=><option key={x.name} value={x.name}>{x.name}</option>)}
           </select>
          </label>}
          {filtersActive.map(f=><label key={f.name} className="block text-xs font-bold text-slate-600">{f.name}
           <select value={f.value} onChange={e=>setFilters(p=>({...p,[f.name]:e.target.value}))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal">{f.choices.map(n=><option key={n} value={n}>{n}</option>)}</select>
          </label>)}
         </div>
         <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
          <label>Gráfico <select className="ml-1 rounded-lg border border-slate-200 bg-white p-2" value={chartType} onChange={e=>setChartType(e.target.value as "line"|"bar")}><option value="line">Linhas</option><option value="bar">Barras</option></select></label>
          <label>Períodos visíveis <select className="ml-1 rounded-lg border border-slate-200 bg-white p-2" value={chartLimit} onChange={e=>setChartLimit(e.target.value)}><option value="30">30</option><option value="100">100</option><option value="all">Todos</option></select></label>
          <p className="text-slate-500">{plotted.length} pontos na seleção · {selectedSet.suppressedSmallCells||0} células pequenas suprimidas</p>
         </div>
         {duplicateCells>0&&<p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Existem {duplicateCells} combinações com múltiplos registros. Não somamos médias, índices ou categorias sem critérios de agregação; refine os filtros antes de interpretar o gráfico.</p>}
         {visual.length>0 ? <div className="mt-5 h-[320px] w-full sm:h-[390px]" role="img" aria-label={selectedSet.title+" com medida "+chosenMeasure}>
          <ResponsiveContainer width="100%" height="100%">
           {chartType==="line"?<LineChart data={visual} margin={{top:10,right:15,left:-10,bottom:30}}>
            <CartesianGrid vertical={false} stroke="#e6ebef"/>
            <XAxis dataKey="period" tick={{fontSize:10}} minTickGap={20} angle={-20} textAnchor="end" height={55}/>
            <YAxis width={67} tick={{fontSize:10}} tickFormatter={v=>integer.format(Number(v))}/>
            <Tooltip formatter={v=>measureFmt(Number(v),chosenMeasure)}/><Legend wrapperStyle={{fontSize:11}}/>
            {categoryKeys.map(s=><Line key={s.key} type="monotone" dataKey={s.key} name={s.name} connectNulls={false} dot={visual.length<30?{r:2}:false} stroke={s.color} strokeWidth={2.5}/>)}
           </LineChart>:<BarChart data={visual} margin={{top:10,right:15,left:-10,bottom:30}}>
            <CartesianGrid vertical={false} stroke="#e6ebef"/>
            <XAxis dataKey="period" tick={{fontSize:10}} minTickGap={20} angle={-20} textAnchor="end" height={55}/>
            <YAxis width={67} tick={{fontSize:10}} tickFormatter={v=>integer.format(Number(v))}/>
            <Tooltip formatter={v=>measureFmt(Number(v),chosenMeasure)}/><Legend wrapperStyle={{fontSize:11}}/>
            {categoryKeys.map(s=><Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} maxBarSize={55}/>)}
           </BarChart>}
          </ResponsiveContainer>
         </div>:<p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">Nenhuma observação para os filtros selecionados. Não preencher com zero.</p>}
         <div className="mt-4 space-y-2 text-xs leading-relaxed text-slate-600">
          {selectedSet.notes&&<p><strong>Nota:</strong> {selectedSet.notes}</p>}
          {selectedSet.stale&&<p className="text-amber-800"><strong>Fotografia anterior:</strong> o último download da API falhou. Dados verificados preservados.</p>}
          <p>Unidade de referência: {selectedSet.unit||"Conforme denominação da medida"} · Fonte: {selectedSet.annotations?.source_name||"Sebrae/OLAP"}. Medidas de média/taxa não são somadas entre grupos.</p>
          <p>Origem: <a className="font-semibold text-brand-700 underline" href={selectedSet.sourceUrl||SOURCE} target="_blank" rel="noopener noreferrer">Consulta pública verificada <ExternalLink size={11}/></a></p>
         </div>
        </>}
       </section>
       {selectedSet.status==="ok"&&<section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 text-sm font-bold"><Filter size={16}/> Tabela de observações por dimensão</h2>
        <div className="mt-3 flex flex-wrap justify-between gap-3 text-xs text-slate-500"><span>{filteredRows.length} linhas filtradas, {tableRows.length} exibidas</span>
         <label>Linhas na tabela <select className="rounded border border-slate-200 p-1" value={tableLimit} onChange={e=>setTableLimit(e.target.value)}><option value="45">45</option><option value="100">100</option><option value="all">Todas</option></select></label>
        </div>
        <div className="mt-3 max-h-[460px] overflow-auto"><table className="min-w-full text-left text-xs">
         <thead className="sticky top-0 bg-slate-50"><tr>{[...selectedSet.dimensions,...measures].map(col=><th className="whitespace-nowrap border-b border-slate-200 px-3 py-3" key={col}>{col}</th>)}</tr></thead>
         <tbody>{tableRows.map((r,i)=><tr key={i} className="border-b border-slate-100">{[...selectedSet.dimensions,...measures].map(key=><td key={key} className="whitespace-nowrap px-3 py-2.5">{measures.includes(key)?(asNumber(r[key])===null?"—":measureFmt(Number(r[key]),key)):String(r[key]??"—")}</td>)}</tr>)}</tbody>
        </table></div>
       </section>}
      </>:<p className="rounded-xl bg-slate-100 p-5 text-sm text-slate-600">Escolha uma série no menu lateral.</p>}
     </div>
    </section>
   </>}
   <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="flex items-center gap-2 text-sm font-bold"><BookOpen size={16}/> Método, origem e limitações</h2>
    <p className="mt-2 text-xs leading-relaxed text-slate-600">O histórico foi pré-processado no GitHub Actions a partir das consultas agregadas públicas do Tesseract Sebrae. São publicados dados de Canoas (IBGE 4304606), não registros individuais nem cópia de gráficos proprietários.</p>
    <ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-relaxed text-slate-600">{doc.methodology.map((text,i)=><li key={i}>{text}</li>)}</ul>
    <Link href="/sebrae" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 underline">Voltar ao panorama sintético <ArrowUpRight size={14}/></Link>
   </section>
  </>}
 </main>;
}
