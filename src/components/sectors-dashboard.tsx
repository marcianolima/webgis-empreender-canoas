"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Leaf, ExternalLink, AlertCircle } from "lucide-react";
import type { SectorObservation, SectorsDocument } from "@/types/sectors";

const prefix = process.env.NEXT_PUBLIC_BASE_PATH || "";
const GROUPS: {id:string;label:string;description:string}[] = [
  {id:"agricultura",label:"Agricultura",description:"PAM/IBGE: área colhida, quantidade e valor da produção das lavouras."},
  {id:"pecuaria",label:"Pecuária",description:"PPM/IBGE: efetivo dos rebanhos por categoria."},
  {id:"extracao_vegetal",label:"Extração vegetal",description:"PEVS/IBGE: produção e valor dos produtos extrativos."},
  {id:"vab_agropecuaria",label:"Valor adicionado da agropecuária",description:"IBGE/PIB: valor adicionado bruto da agropecuária."},
];
const METRICS: Record<string,string> = {
  area_colhida:"Área colhida", quantidade_produzida:"Quantidade produzida",
  valor_producao:"Valor da produção", efetivo_rebanhos:"Efetivo dos rebanhos",
  quantidade_extrativa:"Quantidade extraída", valor_extrativo:"Valor da extração",
  vab_agropecuaria:"Valor adicionado bruto da agropecuária",
};
const nf = new Intl.NumberFormat("pt-BR", {maximumFractionDigits:2});
function csvExport(rows:SectorObservation[]) {
  const data=[["municipio","ano","tema","indicador","produto","valor","unidade","fonte"], ...rows.map(r=>["4304606",String(r.year),r.group,r.metric,r.label,String(r.value),r.unit,r.sourceUrl])];
  const csv="\ufeff"+data.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(";")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="canoas-setores-ibge.csv";a.click();URL.revokeObjectURL(url);
}
export function SectorsDashboard() {
  const [doc,setDoc]=useState<SectorsDocument|null>(null);
  const [error,setError]=useState("");
  const [group,setGroup]=useState("agricultura");
  const [metric,setMetric]=useState("");
  useEffect(()=>{
    const ctrl=new AbortController();
    fetch(prefix+"/data/sectors.json",{cache:"no-store",signal:ctrl.signal})
      .then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json()})
      .then((v:SectorsDocument)=>{if(v.schemaVersion!==1||v.territory!=="4304606")throw Error("Recorte diferente de Canoas");setDoc(v)})
      .catch(e=>{if(e.name!=="AbortError")setError(String(e))});
    return ()=>ctrl.abort();
  },[]);
  const scoped=useMemo(()=>doc?.observations.filter(r=>r.group===group)||[],[doc,group]);
  const metrics=Array.from(new Set(scoped.map(r=>r.metric)));
  const selectedMetric=metrics.includes(metric)?metric:metrics[0]||"";
  const rows=scoped.filter(r=>r.metric===selectedMetric).sort((a,b)=>b.value-a.value);
  const year=rows[0]?.year;
  const unit=rows[0]?.unit;
  return <main className="mx-auto max-w-[1450px] px-4 py-8 text-ink sm:px-6 sm:py-12">
    <Link href="/" className="text-sm font-semibold text-brand-700">← Painel principal</Link>
    <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700"><Leaf size={15}/> IBGE · Indicadores setoriais municipais</span>
        <h1 className="mt-3 text-2xl font-extrabold sm:text-4xl">Setores econômicos de Canoas</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">Agricultura, pecuária, extração vegetal e valor adicionado. Somente observações oficiais para o município de Canoas, com unidade e ano explícitos.</p>
      </div>
      <button onClick={()=>csvExport(doc?.observations||[])} disabled={!doc?.observations.length} className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><Download size={16}/> Exportar CSV</button>
    </div>
    {error&&<p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {doc?.quality.errors.length? <details className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><summary className="cursor-pointer font-semibold">Fontes sem dados ou com falhas ({doc.quality.errors.length})</summary><ul className="mt-2 list-disc pl-5">{doc.quality.errors.map((msg,i)=><li key={i}>{msg}</li>)}</ul></details>:null}
    <div className="mt-7 grid min-w-0 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <nav aria-label="Temas econômicos" className="flex flex-col gap-2">
        {GROUPS.map(item=><button key={item.id} onClick={()=>{setGroup(item.id);setMetric("")}} aria-current={group===item.id?"page":undefined} className={"rounded-xl border p-4 text-left text-sm focus-visible:ring-2 focus-visible:ring-brand-600 "+(group===item.id?"border-brand-500 bg-brand-50 text-brand-900":"border-slate-200 bg-white text-slate-700")}>
          <strong>{item.label}</strong><span className="mt-1 block text-xs leading-relaxed text-slate-500">{item.description}</span></button>)}
      </nav>
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="text-lg font-bold">{GROUPS.find(x=>x.id===group)?.label}</h2>
        <p className="mt-2 text-xs text-slate-500">{GROUPS.find(x=>x.id===group)?.description}</p>
        {scoped.length? <>
          <label className="mt-5 block max-w-md text-xs font-semibold text-slate-600">Indicador
            <select value={selectedMetric} onChange={e=>setMetric(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">
              {metrics.map(name=><option key={name} value={name}>{METRICS[name]||name}</option>)}
            </select>
          </label>
          <p className="mt-4 rounded-xl bg-brand-50 p-3 text-sm font-semibold text-brand-900">Referência: {year} · Unidade: {unit} · Território: Canoas/RS</p>
          <div className="mt-5 h-[300px] w-full" role="img" aria-label={"Resultados oficiais de "+(METRICS[selectedMetric]||selectedMetric)}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows.slice(0,15).map(r=>({name:r.label.length>24?r.label.slice(0,23)+"…":r.label,value:r.value,full:r.label}))} layout="vertical" margin={{left:10,right:15}}>
                <CartesianGrid horizontal={false} stroke="#e5ebee"/><XAxis type="number" tick={{fontSize:10}}/><YAxis dataKey="name" type="category" width={115} tick={{fontSize:10}}/><Tooltip formatter={v=>nf.format(Number(v))} labelFormatter={(v,p)=>String(p?.[0]?.payload?.full||v)}/><Bar dataKey="value" name={METRICS[selectedMetric]||selectedMetric} fill="#087f66" radius={[0,4,4,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 max-h-[260px] overflow-y-auto">{rows.map(r=><div key={r.category+"-"+r.metric} className="flex justify-between gap-4 border-b border-slate-100 py-2.5 text-xs"><span>{r.label}</span><strong className="shrink-0">{nf.format(r.value)} {r.unit}</strong></div>)}</div>
          <a className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-brand-700 underline" href={rows[0]?.sourceUrl} target="_blank" rel="noopener noreferrer">Consultar tabela IBGE original <ExternalLink size={13}/></a>
        </>: <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600"><AlertCircle className="mx-auto mb-3 text-slate-400" size={22}/>Nenhuma observação municipal publicada para esta categoria. Não interpretamos ausência como zero.</div>}
      </section>
    </div>
    <section className="mt-6 rounded-2xl bg-brand-50 p-5">
      <p className="text-sm font-bold text-brand-900">Limitações e metodologia</p>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-xs leading-relaxed text-brand-900">{(doc?.quality.notes||[]).map((msg,i)=><li key={i}>{msg}</li>)}</ul>
      <p className="mt-3 text-xs text-brand-900">Turismo, exportações e força de trabalho exigem dados específicos; os BIs do DEE e o DataRS estão relacionados na página <Link href="/fontes" className="font-semibold underline">Fontes públicas</Link>.</p>
    </section>
  </main>;
}
