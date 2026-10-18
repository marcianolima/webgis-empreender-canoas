"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Building2, ChartBar, Download, FileClock, Filter, Layers, MapPin, ShieldCheck } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, LineChart, Line } from "recharts";
import type { CnpjSnapshot } from "@/types/cnpj";

const prefix = process.env.NEXT_PUBLIC_BASE_PATH || "";
const num = new Intl.NumberFormat("pt-BR");
const fmtPercent = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
const PORTE: Record<string, string> = { "00": "Não informado", "01": "Microempresa (ME)", "03": "Pequeno porte (EPP)", "05": "Demais empresas", "?": "Não informado" };

export function CnpjDashboard() {
  const [data, setData] = useState<CnpjSnapshot | null>(null);
  const [error, setError] = useState("");
  const [sector, setSector] = useState("all");
  const [district, setDistrict] = useState("all");
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(prefix + "/data/cnpj.json", { cache: "no-store", signal: ctrl.signal })
      .then(r => { if (!r.ok) throw Error("HTTP " + r.status); return r.json(); })
      .then((value: CnpjSnapshot) => {
        if (value.schemaVersion !== 1 || value.municipalityIbgeCode !== "4304606") throw Error("Fonte territorial não é Canoas");
        setData(value);
      }).catch(e => { if (e.name !== "AbortError") setError(String(e)); });
    return () => ctrl.abort();
  }, []);

  const official = data?.status === "official" && !!data.kpis;
  const kpi = data?.kpis;
  const year = data?.reference?.slice(0,4) || "";
  const sectors = data?.bySector || [];
  const places = data?.byDistrictDeclared || [];
  const intersection = useMemo(() => {
    if (!data) return [];
    return data.districtSectorCells
      .filter(item => (sector === "all" || item.sector === sector)
        && (district === "all" || item.district === district))
      .sort((a,b) => b.count-a.count).slice(0,30);
  }, [data,sector,district]);

  function exportAggregates() {
    if (!data || !official) return;
    const rows: string[][] = [
      ["territorio","competencia","dimensao","categoria","estabelecimentos_ativos"],
      ...data.bySector.map(r => ["4304606", data.reference || "", "secao_CNAE", r.name, String(r.count)]),
      ...data.byDistrictDeclared.map(r => ["4304606", data.reference || "", "bairro_cadastral", r.name, String(r.count)]),
      ...data.byPorte.map(r => ["4304606", data.reference || "", "porte", r.name, String(r.count)]),
    ];
    const csv = "\ufeff" + rows.map(r => r.map(c => '"' + c.replaceAll('"','""') + '"').join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"}));
    const a = document.createElement("a"); a.href=url; a.download="cnpj-canoas-agregados-"+data.reference+".csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return <main className="mx-auto max-w-[1480px] px-4 py-8 text-ink sm:px-6 sm:py-12">
    <Link href="/" className="text-sm font-semibold text-brand-700">← Painel principal</Link>
    <Link href="/bairros" className="ml-4 inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-800">Explorar bairros e densidade →</Link>
    <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700"><ShieldCheck size={14}/> Receita Federal · Base oficial CNPJ</span>
        <h1 className="mt-3 text-2xl font-extrabold sm:text-4xl">Estabelecimentos de Canoas</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">Matrizes e filiais, CNAE, portes, MEI, Simples e movimentos cadastrais. Apenas dados oficiais completos e validados, sem estimativas ou pontos fictícios.</p>
      </div>
      <button disabled={!official} onClick={exportAggregates} className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><Download size={17}/> Exportar agregados CSV</button>
    </div>
    {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {(!data && !error) && <p className="mt-6 text-sm text-slate-600">Carregando fotografia cadastral…</p>}
    {data && !official && <section className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-6">
      <div className="flex items-center gap-3 text-amber-900"><FileClock size={24}/><h2 className="text-lg font-bold">Carga oficial integral ainda não publicada</h2></div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-amber-900">A publicação exige ler todos os dez fragmentos de Estabelecimentos, todos os dez de Empresas, Simples/MEI e tabelas auxiliares da mesma competência. Não exibimos contagens parciais.</p>
      <a href="https://github.com/marcianolima/webgis-empreender-canoas/actions/workflows/cnpj.yml" target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-semibold text-amber-900 underline">Acompanhar ingestão no GitHub Actions ↗</a>
    </section>}

    {official && kpi && <>
      <div className="mt-5 rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-900">
        Fotografia oficial RFB: <strong>{data.reference}</strong> · {num.format(data.coverage?.recordsMunicipality || 0)} estabelecimentos lidos no recorte · <strong>{data.coverage?.establishmentShards}/10</strong> partes de Estabelecimentos e <strong>{data.coverage?.companyShards}/10</strong> partes de Empresas.
      </div>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores CNPJ">
        {[
          {name:"Estabelecimentos ativos",value:kpi.active,note:"Situação cadastral 02",icon:<Building2 size={18}/>},
          {name:"Aberturas no mês",value:kpi.openMonth,note:"Data de início da atividade em "+data.reference,icon:<ChartBar size={18}/>},
          {name:"Aberturas no ano",value:kpi.openYear,note:"Ano de início "+year,icon:<Layers size={18}/>},
          {name:"Baixas no ano",value:kpi.closedYearLatestSituation,note:"Situação 08 na fotografia, data de situação em "+year,icon:<FileClock size={18}/>},
        ].map(item => <div key={item.name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="flex justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><span>{item.name}</span><span className="text-brand-700">{item.icon}</span></div>
          <p className="mt-3 text-3xl font-extrabold">{num.format(item.value)}</p>
          <p className="mt-2 text-xs text-slate-500">{item.note}</p>
        </div>)}
      </section>
      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">MEI entre optantes conhecidos</p><p className="mt-2 text-2xl font-bold">{kpi.meiKnown ? fmtPercent(100*kpi.meiActive/kpi.meiKnown) : "N/D"}</p><p className="text-xs text-slate-500">{num.format(kpi.meiKnown)} ativos com campo conhecido</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Simples entre optantes conhecidos</p><p className="mt-2 text-2xl font-bold">{kpi.simplesKnown ? fmtPercent(100*kpi.simplesActive/kpi.simplesKnown) : "N/D"}</p><p className="text-xs text-slate-500">{num.format(kpi.simplesKnown)} ativos com campo conhecido</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Baixados na fotografia</p><p className="mt-2 text-2xl font-bold">{num.format(kpi.baixados_snapshot)}</p><p className="text-xs text-slate-500">Não é número de baixas do mês</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Saldo cadastral aproximado no ano</p><p className="mt-2 text-2xl font-bold">{num.format(kpi.balanceYearProxy)}</p><p className="text-xs text-slate-500">Não é variação de estoque entre snapshots</p></div>
      </section>
      <section className="mt-6 grid gap-5 xl:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="text-lg font-bold">Aberturas e baixas por mês</h2>
          <p className="mt-1 text-xs text-slate-500">Aberturas: data de início. Baixas: última situação 08 com data cadastral no mês.</p>
          <div className="mt-5 h-[290px]" role="img" aria-label="Séries de aberturas e baixas cadastrais da Receita Federal">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={data.monthly.slice(-36)} margin={{left:-12,right:12,bottom:4}}>
              <CartesianGrid vertical={false} stroke="#e6ebef"/><XAxis dataKey="month" minTickGap={20} tick={{fontSize:9}}/><YAxis width={55} tick={{fontSize:10}}/><Tooltip/><Legend wrapperStyle={{fontSize:11}}/><Line name="Aberturas" dataKey="openings" stroke="#087f66" strokeWidth={2.5} dot={false}/><Line name="Baixas (última situação)" dataKey="closingsLatestSituation" stroke="#d97742" strokeWidth={2.5} dot={false}/>
            </LineChart></ResponsiveContainer>
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="text-lg font-bold">Principais seções CNAE</h2>
          <p className="mt-1 text-xs text-slate-500">Estabelecimentos ativos por atividade principal.</p>
          <div className="mt-5 h-[290px]" role="img" aria-label="Ranking de seções CNAE dos estabelecimentos ativos">
            <ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={sectors.slice(0,12)} margin={{left:0,right:20}}>
              <CartesianGrid horizontal={false} stroke="#e6ebef"/><XAxis type="number" tick={{fontSize:10}}/><YAxis type="category" dataKey="name" width={25} tick={{fontSize:11}}/><Tooltip formatter={v=>num.format(Number(v))} labelFormatter={v=>sectors.find(s=>s.name===v)?.label||String(v)}/><Bar dataKey="count" name="Ativos" fill="#087f66" radius={[0,4,4,0]}/>
            </BarChart></ResponsiveContainer>
          </div>
        </div>
      </section>
      <section className="mt-6 grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="text-lg font-bold">Porte das empresas</h2>
          <div className="mt-4 space-y-3">{data.byPorte.map(r=><div key={r.name} className="flex justify-between border-b border-slate-100 pb-3 text-sm"><span>{PORTE[r.name]||r.name}</span><strong>{num.format(r.count)}</strong></div>)}</div>
          <p className="mt-3 text-xs text-slate-500">Porte cadastrado na tabela de Empresas da RFB, atribuído às suas unidades locais.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="flex items-center gap-2 text-lg font-bold"><MapPin size={18} className="text-brand-700"/> Bairros informados à Receita</h2>
          <div className="mt-4 max-h-[340px] space-y-3 overflow-y-auto">{places.slice(0,25).map(r=><div key={r.name} className="flex justify-between gap-2 border-b border-slate-100 pb-3 text-sm"><span>{r.name}</span><strong>{num.format(r.count)}</strong></div>)}</div>
          <p className="mt-3 text-xs text-slate-500">Bairros cadastrais não geocodificados; não representam contagens espaciais validadas em polígonos oficiais.</p>
        </div>
      </section>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Filter size={18} className="text-brand-700"/> Cruzamento territorial × CNAE</h2>
        <p className="mt-2 text-xs text-slate-500">Células com menos de cinco estabelecimentos são omitidas; contagens resultantes podem ser inferiores ao total, e não devem ser interpretadas como universo completo.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">Bairro cadastral
            <select value={district} onChange={e=>setDistrict(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"><option value="all">Todos</option>{places.map(r=><option key={r.name} value={r.name}>{r.name}</option>)}</select>
          </label>
          <label className="text-xs font-semibold text-slate-600">Seção CNAE
            <select value={sector} onChange={e=>setSector(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"><option value="all">Todas</option>{sectors.map(r=><option key={r.name} value={r.name}>{r.name} — {r.label}</option>)}</select>
          </label>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{intersection.map(r=><div key={r.district+"-"+r.sector} className="flex justify-between gap-3 rounded-xl bg-slate-50 p-3 text-xs"><span>{r.district} · {r.sector}</span><strong>{num.format(r.count)}</strong></div>)}</div>
        {!intersection.length && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhuma célula publicável com esta seleção (limiar mínimo: 5).</p>}
      </section>
      <section className="mt-6 rounded-2xl border border-brand-100 bg-brand-50 p-5">
        <h2 className="text-sm font-bold text-brand-900">Qualidade, metodologia e privacidade</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-relaxed text-brand-900">{(data.quality.notes||[]).map((s,i)=><li key={i}>{s}</li>)}</ul>
        <p className="mt-3 text-xs text-brand-900">Fonte: <a className="underline" target="_blank" rel="noopener noreferrer" href={data.sourceUrl}>Receita Federal (arquivo mensal oficial) ↗</a>. Nenhum ponto geográfico individual está publicado.</p>
      </section>
    </>}
  </main>;
}
