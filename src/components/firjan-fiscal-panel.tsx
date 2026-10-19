"use client";

import {useEffect,useState} from "react";
import {Wallet,Download,ExternalLink} from "lucide-react";
import {ResponsiveContainer,LineChart,Line,CartesianGrid,XAxis,YAxis,Tooltip,Legend} from "recharts";

type Dimension="general"|"autonomy"|"personnel"|"liquidity"|"investment";
type Observation={year:number;values:Record<Dimension,number>};
type Fiscal={
 schemaVersion:number;status:string;territory:string;edition:number;
 referenceYear:number;sourceUrl:string;publicationUrl:string;methodologyUrl:string;
 range:{start:number;end:number;count:number};series:Observation[];
};
const pathPrefix=process.env.NEXT_PUBLIC_BASE_PATH||"";
const four=new Intl.NumberFormat("pt-BR",{minimumFractionDigits:4,maximumFractionDigits:4});
const diff=new Intl.NumberFormat("pt-BR",{signDisplay:"always",minimumFractionDigits:4,maximumFractionDigits:4});
const titles:Record<Dimension,string>={
 general:"IFGF Geral",autonomy:"Autonomia",personnel:"Gastos com Pessoal",
 liquidity:"Liquidez",investment:"Investimentos"
};
const colors:Record<Dimension,string>={
 general:"#0b806a",autonomy:"#247f96",personnel:"#80619b",liquidity:"#cc7a21",investment:"#b05055"
};
const dimensions=Object.keys(titles) as Dimension[];
const classification=(n:number)=>n<.4?"Gestão crítica":n<.6?"Gestão em dificuldade":n<.8?"Boa gestão":"Gestão de excelência";

function exportFiscal(data:Fiscal){
 const rows:(string|number)[][]=[["municipio_ibge","fonte","edicao","ano_base","indicador","indice"]];
 for(const obs of data.series)for(const k of dimensions)rows.push(["4304606","Firjan IFGF",data.edition,obs.year,k,obs.values[k].toFixed(4).replace(".",",")]);
 const csv="\ufeff"+rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(";")).join("\r\n");
 const href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
 const a=document.createElement("a");a.href=href;a.download="firjan-ifgf-canoas-2013-2024.csv";a.click();URL.revokeObjectURL(href);
}

export function FirjanFiscalPanel(){
 const [data,setData]=useState<Fiscal|null>(null);
 const [error,setError]=useState("");
 const [selected,setSelected]=useState<Dimension|"all">("all");
 useEffect(()=>{
  const controller=new AbortController();
  fetch(pathPrefix+"/data/ifgf-firjan.json",{signal:controller.signal,cache:"no-store"})
   .then(async r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json();})
   .then((j:Fiscal)=>{
    if(j.schemaVersion!==1||j.status!=="verified"||j.territory!=="4304606"||
      j.edition!==2025||j.range.start!==2013||j.referenceYear!==2024||j.range.count!==12||
      j.series.length!==12||j.series.at(-1)?.year!==2024)throw Error("IFGF não validado");
    setData(j);
   }).catch(e=>{if(e.name!=="AbortError")setError(String(e.message||e));});
  return ()=>controller.abort();
 },[]);
 const current=data?.series.at(-1),first=data?.series[0];
 const shown=selected==="all"?dimensions:[selected];
 return <section id="firjan-ifgf" aria-labelledby="ifgf-heading" className="min-w-0 space-y-4">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div>
    <h2 id="ifgf-heading" className="flex items-center gap-2 text-xl font-bold text-ink">
     <Wallet size={21} className="text-brand-700"/> Gestão fiscal municipal · Firjan
    </h2>
    <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
     Índice Firjan de Gestão Fiscal (IFGF): capacidade fiscal da prefeitura, em escala de 0 a 1.
     Última edição: <strong>2025, ano-base 2024</strong>, com série de 2013 a 2024.
    </p>
   </div>
   {data&&<button type="button" onClick={()=>exportFiscal(data)}
    className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-50">
    <Download size={15}/> Exportar série IFGF</button>}
  </div>
  {error&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900" role="alert">
   Os dados IFGF não puderam ser validados: {error}. Consulte a fonte oficial indicada abaixo.
  </div>}
  {current&&first?<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
   {dimensions.map(dim=><article key={dim} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
    <div className="flex items-center gap-2">
     <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{backgroundColor:colors[dim]}}/>
     <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{titles[dim]}</p>
    </div>
    <p className="mt-3 text-2xl font-extrabold tabular-nums text-ink">{four.format(current.values[dim])}</p>
    <p className="mt-2 text-[11px] font-semibold text-slate-600">{classification(current.values[dim])}</p>
    <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
     2013: {four.format(first.values[dim])}
    </p>
    <p className="mt-1 text-[11px] font-semibold text-ink">
     Variação: {diff.format(current.values[dim]-first.values[dim])} pontos
    </p>
   </article>)}
  </div>:!error&&<div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Carregando IFGF oficial…</div>}
  {data&&current&&<div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
   <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-6">
    <h3 className="text-base font-bold text-ink">Evolução da situação fiscal · 2013–2024</h3>
    <p className="mt-1 text-xs leading-relaxed text-slate-500">
     Pontuação publicada pela Firjan, não porcentagem de receitas, gastos, dívida ou investimentos.
    </p>
    <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1" aria-label="Selecionar dimensão da gestão fiscal">
     {(["all",...dimensions] as (Dimension|"all")[]).map(k=>
      <button type="button" key={k} aria-pressed={selected===k} onClick={()=>setSelected(k)}
       className={"shrink-0 rounded-lg px-3 py-2 text-xs font-semibold "+
        (selected===k?"bg-brand-600 text-white":"bg-slate-100 text-slate-600 hover:bg-brand-50")}>
       {k==="all"?"Todos os indicadores":titles[k]}
      </button>)}
    </div>
    <div className="mt-4 h-[305px] min-w-0 sm:h-[325px]" role="img" aria-label="Evolução anual do IFGF Canoas de 2013 a 2024">
     <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data.series.map(p=>({year:p.year,...p.values}))} margin={{top:4,right:8,bottom:2,left:0}}>
       <CartesianGrid vertical={false} stroke="#e3e9ed"/>
       <XAxis dataKey="year" tick={{fontSize:11}} interval={0} minTickGap={8}/>
       <YAxis domain={[0,1]} ticks={[0,.2,.4,.6,.8,1]} width={42} tick={{fontSize:11}} tickFormatter={(v:number)=>v.toFixed(1).replace(".",",")}/>
       <Tooltip formatter={(v,name)=>[four.format(Number(v)),String(name)]} labelFormatter={v=>"Ano-base "+v}/>
       <Legend wrapperStyle={{fontSize:11}}/>
       {shown.map(k=><Line key={k} type="monotone" dataKey={k} name={titles[k]}
        stroke={colors[k]} strokeWidth={3} isAnimationActive={false} connectNulls={false}
        dot={{r:2.6}} activeDot={{r:5}}/>)}
      </LineChart>
     </ResponsiveContainer>
    </div>
   </article>
   <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
    <h3 className="text-base font-bold text-ink">Como interpretar o IFGF</h3>
    <p className="mt-2 text-xs leading-relaxed text-slate-600">
     O índice geral é a média de quatro notas, com peso de 25% para cada componente.
     Valores mais próximos de 1 indicam melhor situação fiscal.
    </p>
    <div className="mt-4 space-y-2 text-xs text-slate-700">
     <p><strong>Autonomia:</strong> capacidade de custear a estrutura administrativa com receitas próprias.</p>
     <p><strong>Gastos com Pessoal:</strong> grau de rigidez do orçamento causado pelas despesas com pessoal.</p>
     <p><strong>Liquidez:</strong> disponibilidade de caixa para cobrir obrigações a pagar.</p>
     <p><strong>Investimentos:</strong> prioridade dada aos investimentos em relação à receita total.</p>
    </div>
    <p className="mt-4 rounded-xl bg-brand-50 p-3 text-xs leading-relaxed text-brand-900">
     Crítica abaixo de 0,4; em dificuldade de 0,4 a menos de 0,6; boa de 0,6 a menos de 0,8; excelência a partir de 0,8.
    </p>
    <p className="mt-3 text-xs leading-relaxed text-slate-500">
     <strong>Não confundir:</strong> IFGF mede gestão fiscal, enquanto IFDM mede desenvolvimento socioeconômico.
     A planilha histórica não contém rankings municipais; por isso não apresentamos posições estimadas.
    </p>
    <div className="mt-4 flex flex-col gap-1">
     <a href={data.publicationUrl} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline">
      Fonte oficial IFGF 2025 <ExternalLink size={12}/></a>
     <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
      Série histórica XLSX da Firjan <ExternalLink size={12}/></a>
     <a href={data.methodologyUrl} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
      Metodologia IFGF <ExternalLink size={12}/></a>
    </div>
   </article>
  </div>}
  <p className="text-xs leading-relaxed text-slate-500">
   Fonte: Federação das Indústrias do Estado do Rio de Janeiro · IFGF 2025 (ano-base 2024);
   série histórica municipal 2013–2024. <strong>Não representa dados fiscais de 2026.</strong>
  </p>
 </section>;
}
