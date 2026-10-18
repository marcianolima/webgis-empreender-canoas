"use client";

import { useMemo, useState } from "react";
import { BarChart3, ExternalLink, FileClock, ShieldCheck, AlertCircle } from "lucide-react";
import { LineChart, Line, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ExternalIndicatorRecord, IndicatorId } from "@/lib/external-sources";

const METRICS: {id:IndicatorId;label:string}[]=[
  {id:"tempo_abertura_horas",label:"Tempo total de abertura (horas)"},
  {id:"tempo_viabilidade_horas",label:"Tempo de viabilidade (horas)"},
  {id:"tempo_registro_horas",label:"Tempo de registro (horas)"},
  {id:"aberturas",label:"Empresas abertas"},
  {id:"baixas",label:"Empresas baixadas"},
];
const METHODOLOGY_URL="https://www.gov.br/empresas-e-negocios/pt-br/mapa-de-empresas/painel-mapa-de-empresas";
const JUCIS_URL="https://www.redesim.rs.gov.br/";

export function RedesimDashboard({records}:{records:ExternalIndicatorRecord[]}) {
  const [metric,setMetric]=useState<IndicatorId>("tempo_abertura_horas");
  const [source,setSource]=useState<string>("all");
  const valid=useMemo(()=>records.filter(r=>
    r.territorio==="4304606" &&
    ["mapa_empresas","redesim_jucisrs"].includes(r.fonte)
  ),[records]);
  const sources=Array.from(new Set(valid.map(r=>r.fonte)));
  const filtered=useMemo(()=>valid.filter(r=>r.indicador===metric && (source==="all"||source===r.fonte))
    .sort((a,b)=>a.competencia.localeCompare(b.competencia)),[valid,metric,source]);
  const unitMetric=filtered[0];
  const comparable=filtered.filter(r=>!unitMetric||(r.universo===unitMetric.universo && r.unidade===unitMetric.unidade && r.segmento===unitMetric.segmento));
  return <div className="mt-8 space-y-5">
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        ["Séries verificadas",String(valid.length)],
        ["Fontes com dados",String(sources.length)],
        ["Município","Canoas · 4304606"],
      ].map(([label,value])=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><span className="block text-xs font-semibold uppercase text-slate-500">{label}</span><span className="mt-2 block text-xl font-extrabold text-ink">{value}</span></div>)}
    </div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="flex items-center gap-2 text-lg font-bold"><BarChart3 size={18} className="text-brand-700"/> Indicadores municipais REDESIM</h2>
      <p className="mt-2 text-sm text-slate-600">Somente exportações oficiais verificadas, preservando o universo de empresas, data e metodologia.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-600">Indicador
          <select value={metric} onChange={e=>setMetric(e.target.value as IndicatorId)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">{METRICS.map(m=><option value={m.id} key={m.id}>{m.label}</option>)}</select>
        </label>
        <label className="text-xs font-semibold text-slate-600">Fonte
          <select value={source} onChange={e=>setSource(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"><option value="all">Fontes disponíveis</option>{sources.map(s=><option key={s} value={s}>{s}</option>)}</select>
        </label>
      </div>
      {comparable.length ? <>
        <div className="mt-5 h-[300px] w-full" role="img" aria-label="Indicadores processuais municipais de abertura e legalização de empresas">
          <ResponsiveContainer width="100%" height="100%"><LineChart data={comparable} margin={{left:0,right:18,bottom:5}}>
            <CartesianGrid vertical={false} stroke="#e5ebee"/><XAxis dataKey="competencia" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}} width={55}/><Tooltip formatter={v=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2}).format(Number(v))}/><Line dataKey="valor" name={METRICS.find(m=>m.id===metric)?.label} stroke="#087f66" strokeWidth={3}/>
          </LineChart></ResponsiveContainer>
        </div>
        <p className="mt-4 text-xs text-slate-500"><strong>Universo:</strong> {unitMetric?.universo} · <strong>Segmento:</strong> {unitMetric?.segmento||"Total"} · <strong>Unidade:</strong> {unitMetric?.unidade}</p>
        <a href={unitMetric?.url_origem} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-brand-700 underline">Acessar registro original <ExternalLink size={14}/></a>
      </> : <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600"><AlertCircle size={23} className="mx-auto mb-2 text-slate-400"/>Ainda não há exportação numérica de Canoas validada para este indicador. Não calculamos valores processuais a partir de datas CNPJ.</div>}
    </section>
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold text-amber-900"><FileClock size={18}/> Quebra metodológica em dezembro de 2025</h2>
      <p className="mt-2 text-sm leading-relaxed text-amber-900">O Mapa de Empresas informa que o Módulo de Administração Tributária (MAT) passou a integrar o fluxo de emissão do CNPJ, alterando o tempo de abertura apurado. Comparações anteriores e posteriores a dezembro de 2025 exigem ressalva metodológica.</p>
    </section>
    <section className="rounded-2xl border border-brand-100 bg-brand-50 p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold text-brand-900"><ShieldCheck size={18}/> Fontes e processo de atualização</h2>
      <p className="mt-2 text-sm leading-relaxed text-brand-900">A integração aceita arquivos agregados exportados oficialmente do Mapa de Empresas ou da JucisRS, com código IBGE 4304606, competência, universo, unidade e URL de origem. Não acessa endpoints internos de Power BI nem dados processuais restritos.</p>
      <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-brand-700">
        <a href={METHODOLOGY_URL} target="_blank" rel="noopener noreferrer" className="underline">Mapa de Empresas (Gov.br) ↗</a>
        <a href={JUCIS_URL} target="_blank" rel="noopener noreferrer" className="underline">Portal REDESIM RS ↗</a>
      </div>
    </section>
  </div>;
}
