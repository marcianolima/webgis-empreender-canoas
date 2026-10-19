"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, LineChart, Line } from "recharts";
import { BriefcaseBusiness, Download, Globe2, ExternalLink } from "lucide-react";
import type { DeeDocument, DeeObservation } from "@/types/dee";

const base=process.env.NEXT_PUBLIC_BASE_PATH||"";
const currency=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"USD",maximumFractionDigits:0});
const number=new Intl.NumberFormat("pt-BR");
const INDICATORS=[
  {id:"vinculos_formais",label:"Vínculos empregatícios formais",desc:"Emprego formal (vínculos, não pessoas únicas)."},
  {id:"exportacoes_usd",label:"Exportações em US$ FOB",desc:"Exportações municipais em dólares, valores FOB."},
];
export function DeeDashboard() {
  const [doc,setDoc]=useState<DeeDocument|null>(null);
  const [error,setError]=useState("");
  const [selected,setSelected]=useState("vinculos_formais");
  useEffect(()=>{
    const ctrl=new AbortController();
    fetch(base+"/data/dee.json",{signal:ctrl.signal,cache:"no-store"})
      .then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json()})
      .then((d:DeeDocument)=>{if(d.schemaVersion!==1||d.territory!=="4304606")throw Error("Recorte municipal inválido");setDoc(d)})
      .catch(e=>{if(e.name!=="AbortError")setError(String(e))});
    return ()=>ctrl.abort();
  },[]);
  const rows=useMemo(()=>doc?.observations.filter(r=>r.metric===selected).sort((a,b)=>a.year-b.year)||[],[doc,selected]);
  const latest=rows.at(-1);
  const format=(row:DeeObservation|undefined) => row?(selected==="exportacoes_usd"?currency.format(row.value):number.format(row.value)):"Não disponível";
  const exportCsv=()=>{
    if(!doc?.observations.length)return;
    const rows=[["municipio","indicador","ano","valor","unidade","fonte"],
      ...doc.observations.map(r=>["4304606",r.metric,String(r.year),String(r.value),r.unit,r.sourceUrl])];
    const csv="\ufeff"+rows.map(r=>r.map(v=>'"'+v.replaceAll('"','""')+'"').join(";")).join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download="canoas-dee-emprego-exportacoes.csv";a.click();URL.revokeObjectURL(url);
  };
  return <main className="mx-auto max-w-[1400px] px-4 py-8 text-ink sm:px-6 sm:py-12">
    <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
      <div><span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700"><BriefcaseBusiness size={16}/> DEE / DataRS · Recorte Canoas</span>
      <h1 className="mt-3 text-2xl font-extrabold sm:text-4xl">Emprego e comércio exterior</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">Séries municipais reais publicadas pelo Departamento de Economia e Estatística do RS: exportações e vínculos formais.</p></div>
      <button disabled={!doc?.observations.length} onClick={exportCsv} className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><Download size={16}/> Exportar CSV</button>
    </div>
    {error&&<p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {doc?.quality.errors.length? <details className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><summary className="cursor-pointer font-semibold">Avisos sobre dados disponíveis</summary>{doc.quality.errors.map((e,i)=><p key={i} className="mt-2">{e}</p>)}</details>:null}
    <div className="mt-7 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <nav className="flex flex-col gap-2" aria-label="Indicador econômico">
        {INDICATORS.map(i=><button key={i.id} onClick={()=>setSelected(i.id)} aria-current={selected===i.id?"page":undefined} className={"rounded-xl border p-4 text-left text-sm "+(selected===i.id?"border-brand-500 bg-brand-50":"border-slate-200 bg-white")}><strong>{i.label}</strong><span className="mt-1 block text-xs leading-relaxed text-slate-500">{i.desc}</span></button>)}
      </nav>
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="text-lg font-bold">{INDICATORS.find(i=>i.id===selected)?.label}</h2>
        <p className="mt-2 text-xs text-slate-500">{INDICATORS.find(i=>i.id===selected)?.desc}</p>
        {latest?<>
          <div className="mt-5 rounded-xl bg-brand-50 p-4">
            <p className="text-xs font-semibold text-brand-700">Última competência anual disponível · {latest.year}</p>
            <p className="mt-2 break-words text-2xl font-extrabold sm:text-3xl">{format(latest)}</p>
            <p className="mt-1 text-xs text-slate-600">Unidade: {latest.unit} · Território: Canoas (4304606)</p>
          </div>
          <div className="mt-6 h-[295px] w-full" role="img" aria-label={INDICATORS.find(i=>i.id===selected)?.label}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{left:0,right:16,bottom:0}}>
                <CartesianGrid vertical={false} stroke="#e4ebef"/><XAxis dataKey="year" tick={{fontSize:11}}/><YAxis width={70} tick={{fontSize:10}} tickFormatter={v=>number.format(Number(v))}/><Tooltip formatter={v=>selected==="exportacoes_usd"?currency.format(Number(v)):number.format(Number(v))}/><Line type="monotone" dataKey="value" name={latest.label} stroke="#087f66" strokeWidth={3} dot={{r:3}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex flex-col gap-2">{rows.map(r=><div key={r.year} className="flex justify-between border-b border-slate-100 py-2 text-sm"><span>{r.year}</span><strong>{format(r)}</strong></div>)}</div>
          <a href={latest.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-brand-700 underline">Consultar CSV oficial no DataRS <ExternalLink size={14}/></a>
        </>:<div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600"><Globe2 className="mx-auto mb-2 text-slate-400"/>Série municipal ainda não publicada. Nenhum valor é estimado.</div>}
      </section>
    </div>
    <section className="mt-6 rounded-2xl bg-brand-50 p-5">
      <h2 className="text-sm font-bold text-brand-900">Notas metodológicas</h2>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-xs leading-relaxed text-brand-900">{(doc?.quality.notes||[]).map((n,i)=><li key={i}>{n}</li>)}</ul>
      <p className="mt-3 text-xs text-brand-900">Mais indicadores e painéis de comércio exterior: <Link href="/fontes" className="font-semibold underline">Fontes públicas / DEE BI Setorial</Link>.</p>
    </section>
  </main>;
}
