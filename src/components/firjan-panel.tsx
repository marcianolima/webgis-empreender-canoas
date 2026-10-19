"use client";

import {useEffect,useMemo,useState} from "react";
import {Activity,Download,ExternalLink,TrendingUp} from "lucide-react";
import {
 ResponsiveContainer,LineChart,Line,CartesianGrid,XAxis,YAxis,Tooltip,Legend
} from "recharts";

type Dimension="general"|"employmentIncome"|"education"|"health";
type Selection=Dimension|"all";
type Point={
 year:number;
 values:Record<Dimension,number>;
 ranking:Record<Dimension,{state:number;brazil:number}>;
};
type IFDM={
 schemaVersion:number;status:"verified";
 territory:string;municipality:string;edition:number;referenceYear:number;
 sourceUrl:string;publicationUrl:string;methodologyUrl:string;
 range:{start:number;end:number;count:number};
 series:Point[];notes:string[];
};
const ROOT=process.env.NEXT_PUBLIC_BASE_PATH||"";
const four=new Intl.NumberFormat("pt-BR",{minimumFractionDigits:4,maximumFractionDigits:4});
const count=new Intl.NumberFormat("pt-BR");
const signed=new Intl.NumberFormat("pt-BR",{signDisplay:"always",minimumFractionDigits:4,maximumFractionDigits:4});
const definitions:Record<Dimension,{title:string;short:string;color:string}>={
 general:{title:"IFDM Geral",short:"Geral",color:"#0b806a"},
 employmentIncome:{title:"Emprego e Renda",short:"Emprego e Renda",color:"#247f96"},
 education:{title:"Educação",short:"Educação",color:"#cc7a21"},
 health:{title:"Saúde",short:"Saúde",color:"#80619b"}
};
const dimensions=Object.keys(definitions) as Dimension[];
function grade(v:number):string{
 return v<.4?"Crítico":v<.6?"Baixo":v<.8?"Moderado":"Alto";
}
function exportCsv(data:IFDM){
 const values:(string|number)[][]=[["codigo_ibge","municipio","fonte","edicao","ano_base","indicador","ifdm","ranking_rs","ranking_brasil"]];
 for(const p of data.series)for(const dim of dimensions){
  values.push([data.territory,data.municipality,"Firjan IFDM",data.edition,p.year,dim,
    p.values[dim].toFixed(4).replace(".",","),p.ranking[dim].state,p.ranking[dim].brazil]);
 }
 const csv="\ufeff"+values.map(row=>row.map(cell=>'"'+String(cell).replaceAll('"','""')+'"').join(";")).join("\r\n");
 const objectUrl=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
 const a=document.createElement("a");a.href=objectUrl;
 a.download="firjan-ifdm-canoas-2013-2023.csv";a.click();URL.revokeObjectURL(objectUrl);
}

export function FirjanPanel(){
 const [data,setData]=useState<IFDM|null>(null);
 const [error,setError]=useState("");
 const [metric,setMetric]=useState<Selection>("all");
 useEffect(()=>{
  const abort=new AbortController();
  fetch(ROOT+"/data/ifdm-firjan.json",{cache:"no-store",signal:abort.signal})
   .then(async(response)=>{if(!response.ok)throw new Error("HTTP "+response.status);return response.json();})
   .then((payload:IFDM)=>{
    if(payload.schemaVersion!==1||payload.status!=="verified"||payload.territory!=="4304606"
     ||payload.series.length!==payload.range.count||payload.range.start!==2013
     ||payload.referenceYear!==payload.range.end||payload.series.at(-1)?.year!==2023){
     throw new Error("Série Firjan não validada para Canoas");
    }
    setData(payload);
   })
   .catch(err=>{if(err.name!=="AbortError")setError(String(err.message||err));});
  return ()=>abort.abort();
 },[]);
 const history=useMemo(()=>data?.series.map(row=>({year:row.year,...row.values}))||[],[data]);
 const latest=data?.series.at(-1);
 const first=data?.series[0];
 const chosen=metric==="all"?dimensions:[metric];
 return <section id="firjan" className="min-w-0 space-y-4" aria-labelledby="firjan-heading">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div>
    <h2 id="firjan-heading" className="flex items-center gap-2 text-xl font-bold text-ink">
     <Activity size={21} className="text-brand-700"/> Desenvolvimento municipal · Firjan
    </h2>
    <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
     Índice Firjan de Desenvolvimento Municipal (IFDM). Última edição disponível: 2025, <strong>ano-base 2023</strong>.
     Série histórica revisada de 2013 a 2023; valores de 0 a 1.
    </p>
   </div>
   {data&&<button type="button" onClick={()=>exportCsv(data)}
    className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-50">
    <Download size={15}/> Exportar série IFDM
   </button>}
  </div>
  {error&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
   Série Firjan indisponível: {error}. Consulte a publicação oficial abaixo.
  </p>}
  {latest&&first?<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   {dimensions.map(dim=>{
    const value=latest.values[dim],prior=first.values[dim],difference=value-prior;
    return <article key={dim} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
     <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{backgroundColor:definitions[dim].color}}/>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{definitions[dim].title}</p>
     </div>
     <p className="mt-3 text-3xl font-extrabold tabular-nums text-ink">{four.format(value)}</p>
     <p className="mt-1 text-xs font-semibold text-slate-700">Desenvolvimento {grade(value).toLowerCase()} · 2023</p>
     <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
      2013: {four.format(prior)} <span className="font-bold text-ink">· Variação {signed.format(difference)} ponto{Math.abs(difference)!==1?"s":""}</span>
     </p>
    </article>;
   })}
  </div>:!error&&<div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Carregando histórico oficial da Firjan…</div>}
  {latest&&data&&<div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_285px]">
   <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div>
      <h3 className="text-base font-bold text-ink">Evolução do desenvolvimento municipal</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
       Edição metodológica homogênea · 11 anos consecutivos · 2013–2023.
      </p>
     </div>
     <span className="text-xs font-semibold text-slate-500">Escala fixa: 0–1</span>
    </div>
    <div className="mt-4 flex max-w-full gap-1.5 overflow-x-auto pb-1" aria-label="Selecionar dimensão Firjan">
     {(["all",...dimensions] as Selection[]).map(k=><button type="button" key={k} aria-pressed={metric===k}
      onClick={()=>setMetric(k)}
      className={"shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors "+
       (metric===k?"bg-brand-600 text-white":"bg-slate-100 text-slate-600 hover:bg-brand-50")}>
      {k==="all"?"Todas as dimensões":definitions[k].short}
     </button>)}
    </div>
    <div className="mt-4 h-[300px] w-full min-w-0 sm:h-[325px]" role="img" aria-label="Série IFDM de Canoas por ano entre 2013 e 2023">
     <ResponsiveContainer width="100%" height="100%">
      <LineChart data={history} margin={{top:4,right:8,bottom:2,left:0}}>
       <CartesianGrid vertical={false} stroke="#e3e9ed"/>
       <XAxis dataKey="year" tick={{fontSize:11}} interval={0} minTickGap={8}/>
       <YAxis domain={[0,1]} ticks={[0,.2,.4,.6,.8,1]} width={42} tick={{fontSize:11}}
        tickFormatter={(v:number)=>v.toFixed(1).replace(".",",")}/>
       <Tooltip formatter={(v,name)=>[four.format(Number(v)),String(name)]}
        labelFormatter={v=>"Ano-base "+v}/>
       <Legend wrapperStyle={{fontSize:11}}/>
       {chosen.map(k=><Line key={k} dataKey={k} type="monotone" name={definitions[k].title}
        stroke={definitions[k].color} strokeWidth={3} dot={{r:2.8}} activeDot={{r:5}}
        isAnimationActive={false} connectNulls={false}/>)}
      </LineChart>
     </ResponsiveContainer>
    </div>
    <p className="mt-2 text-xs leading-relaxed text-slate-500">
     Linha anual do índice, não quantidade de empresas ou renda monetária. Valores mais próximos de 1 indicam melhor desenvolvimento.
     Utilize as opções acima para destacar cada dimensão.
    </p>
   </article>
   <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
    <h3 className="flex items-center gap-2 text-base font-bold text-ink"><TrendingUp size={17} className="text-brand-700"/> Posição de Canoas em 2023</h3>
    <div className="mt-4 grid grid-cols-2 gap-3">
     <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-600">Ranking RS · Geral</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{count.format(latest.ranking.general.state)}º</p></div>
     <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-600">Ranking Brasil · Geral</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{count.format(latest.ranking.general.brazil)}º</p></div>
    </div>
    <div className="mt-4 space-y-2 text-xs">
     {(["employmentIncome","education","health"] as Dimension[]).map(k=>
      <div key={k} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
       <span className="text-slate-600">{definitions[k].title}</span>
       <span className="font-semibold tabular-nums text-ink">
        {count.format(latest.ranking[k].state)}º RS · {count.format(latest.ranking[k].brazil)}º BR
       </span>
      </div>)}
    </div>
    <div className="mt-4 rounded-xl bg-brand-50 p-3 text-xs leading-relaxed text-brand-900">
     <strong>Como interpretar:</strong> baixo de 0,4 a menos de 0,6; moderado de 0,6 a menos de 0,8;
     alto a partir de 0,8. Abaixo de 0,4, crítico.
    </div>
    <p className="mt-3 text-xs leading-relaxed text-slate-500">
     O IFDM combina Emprego e Renda, Educação e Saúde. Os rankings são nacionais/estaduais da própria Firjan
     e não podem ser comparados diretamente aos rankings do IBGE ou de outras edições metodológicas.
    </p>
    <div className="mt-4 flex flex-col gap-1">
     <a href={data.publicationUrl} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline">
      Fonte Firjan · edição 2025 <ExternalLink size={12}/></a>
     <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
      Planilha histórica original (XLSX) <ExternalLink size={12}/></a>
     <a href={data.methodologyUrl} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
      Metodologia e conceitos <ExternalLink size={12}/></a>
    </div>
   </article>
  </div>}
  <p className="text-xs leading-relaxed text-slate-500">
   Fonte: Federação das Indústrias do Estado do Rio de Janeiro, IFDM 2025 (ano-base 2023).
   Série histórica revisada 2013–2023, município de Canoas (IBGE 4304606).
   <strong> Não representa dados atuais de 2026.</strong>
  </p>
 </section>;
}
