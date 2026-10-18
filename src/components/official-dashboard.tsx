"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, Database, Download, ExternalLink, Globe2, Landmark, MapPinned, TrendingUp, Users } from "lucide-react";
import { ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, LineChart, Line, BarChart, Bar } from "recharts";
import type { OfficialEconomy } from "@/types/official";

const OfficialMap = dynamic(() => import("@/components/official-map"), { ssr: false, loading: () => <div className="h-[350px] rounded-xl bg-slate-100 p-4 text-sm">Carregando cartografia…</div> });
const prefix = process.env.NEXT_PUBLIC_BASE_PATH || "";
const number = new Intl.NumberFormat("pt-BR");
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 1 });
const groupNames: Record<string, string> = {
  constituidas: "Empresas constituídas", extintas: "Empresas extintas",
  filiais_abertas: "Filiais abertas", filiais_encerradas: "Filiais encerradas",
};
const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function Card({ label, value, note, icon }: { label: string; value?: string; note: string; icon: React.ReactNode }) {
  return <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
    <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><span className="rounded-xl bg-brand-50 p-2 text-brand-700">{icon}</span></div>
    <p className="mt-3 break-words text-2xl font-extrabold text-ink sm:text-3xl">{value || "Indisponível"}</p>
    <p className="mt-2 text-xs leading-relaxed text-slate-500">{note}</p>
  </div>;
}
function Panel({ id, title, note, children }: { id?: string; title: string; note: string; children: React.ReactNode }) {
  return <section id={id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-6">
    <h2 className="text-lg font-bold text-ink">{title}</h2><p className="mt-1 text-xs leading-relaxed text-slate-500">{note}</p>
    <div className="mt-5 min-w-0">{children}</div>
  </section>;
}
function Empty({ label }: { label: string }) {
  return <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">{label}</div>;
}
function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline" href={href} target="_blank" rel="noopener noreferrer">{children}<ExternalLink size={12}/></a>;
}
export function OfficialDashboard() {
  const [data, setData] = useState<OfficialEconomy | null>(null);
  const [error, setError] = useState("");
  const [section, setSection] = useState("all");
  const [year, setYear] = useState("");
  const [kind, setKind] = useState("constituidas");
  const [tab, setTab] = useState("canoas");
  useEffect(() => {
    const controller = new AbortController();
    fetch(prefix + "/data/official.json", { signal: controller.signal, cache: "no-store" })
      .then((response) => { if (!response.ok) throw Error("HTTP " + response.status); return response.json(); })
      .then((payload: OfficialEconomy) => {
        if (payload.schemaVersion !== 1 || payload.municipality.code !== "4304606") throw Error("Recorte territorial inválido");
        setData(payload);
      }).catch((err) => { if (err.name !== "AbortError") setError("Não foi possível carregar os indicadores oficiais: " + err.message); });
    return () => controller.abort();
  }, []);
  const lastCempre = data?.cempreCurrent?.at(-1) ?? data?.cempre.at(-1);
  const hasNewCempre = Boolean(data?.cempreCurrent?.length);
  const lastGdp = data?.gdp.at(-1);
  const lastPopulation = data?.populationEstimate?.at(-1) ?? data?.population.at(-1);
  const hasPopulationEstimate = Boolean(data?.populationEstimate?.length);
  const censusPopulation = data?.population.at(-1);
  const sections = useMemo(() => (data?.cnaeCurrent?.length ? data.cnaeCurrent : data?.cnae || []).filter((r) => section === "all" || r.category === section), [data, section]);
  const years = useMemo(() => Array.from(new Set((data?.rsBusiness || []).map((r) => r.month.slice(0, 4)))).sort((a, b) => b.localeCompare(a)), [data]);
  const selectedYear = years.includes(year) ? year : (years[0] || "");
  const rs = useMemo(() => (data?.rsBusiness || [])
    .filter((r) => r.group === kind && r.month.startsWith(selectedYear))
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => ({ ...r, label: monthNames[Number(r.month.slice(5)) - 1] })), [data, kind, selectedYear]);
  const yearTotal = rs.reduce((a, r) => a + r.value, 0);
  const generated = data?.generatedAt ? new Date(data.generatedAt).toLocaleDateString("pt-BR") : "Coleta pendente";
  const exportData = () => {
    if (!data) return;
    const table: (string | number)[][] = [["territorio", "fonte", "indicador", "referencia", "valor", "unidade"]];
    data.cempre.forEach((r) => table.push(["4304606", "IBGE/CEMPRE_993_SÉRIE_ANTIGA", "empresas_ou_organizacoes", r.year, r.value, "unidades"]));
    data.cempreCurrent?.forEach((r) => table.push(["4304606", "IBGE/CEMPRE_9582_SÉRIE_NOVA", "empresas_ou_organizacoes", r.year, r.value, "unidades"]));
    data.gdp.forEach((r) => table.push(["4304606", "IBGE/PIB", "pib", r.year, r.value, "mil_reais"]));
    data.population.forEach((r) => table.push(["4304606", "IBGE/Censo_2022", "populacao_censitaria", r.year, r.value, "pessoas"]));
    data.populationEstimate?.forEach((r) => table.push(["4304606", "IBGE/ESTIMATIVA_6579", "populacao_estimada", r.year, r.value, "pessoas"]));
    data.rsBusiness.forEach((r) => table.push(["43", "JUCISRS", r.group, r.month, r.value, "registros"]));
    const csv = "\ufeff" + table.map((r) => r.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "indicadores-oficiais-canoas-empreende.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  const goTo = (id: string) => { setTab(id); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); };

  return <>
    <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-white focus:p-3">Ir para o conteúdo</a>
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white"><MapPinned size={23}/></span>
          <span><span className="block text-xl font-extrabold tracking-tight text-ink">Canoas <span className="text-brand-600">Empreende</span></span><span className="block text-xs text-slate-500">Observatório econômico · Dados oficiais</span></span>
        </Link>
        <nav aria-label="Menu principal" className="flex flex-wrap items-center justify-start gap-1 text-sm">
          {[["canoas", "Canoas"], ["rs", "Contexto RS"], ["mapa", "Mapa"]].map(([id, label]) =>
            <button key={id} onClick={() => goTo(id)} className={"rounded-lg px-3 py-2 font-semibold " + (tab === id ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100")}>{label}</button>)}
          <Link href="/cnpj" className="rounded-lg px-3 py-2 font-semibold text-slate-600 hover:bg-slate-100">Empresas CNPJ</Link>
          <Link href="/bairros" className="rounded-lg px-3 py-2 font-semibold text-slate-600 hover:bg-slate-100">Mapa econômico</Link>
          <Link href="/sebrae" className="rounded-lg px-3 py-2 font-semibold text-slate-600 hover:bg-slate-100">Panorama Sebrae</Link>
          <Link href="/sebrae/series" className="rounded-lg px-3 py-2 font-semibold text-slate-600 hover:bg-slate-100">Séries e comparativos</Link>
          <Link href="/setores" className="rounded-lg px-3 py-2 font-semibold text-slate-600 hover:bg-slate-100">Setores</Link>
          <Link href="/trabalho" className="rounded-lg px-3 py-2 font-semibold text-slate-600 hover:bg-slate-100">Emprego e exportações</Link>
          <Link href="/redesim" className="rounded-lg px-3 py-2 font-semibold text-slate-600 hover:bg-slate-100">REDESIM</Link>
          <Link href="/fontes" className="rounded-lg px-3 py-2 font-semibold text-slate-600 hover:bg-slate-100">Fontes</Link>
          <Link href="/sobre" className="rounded-lg px-3 py-2 font-semibold text-slate-600 hover:bg-slate-100">Sobre</Link>
        </nav>
      </div>
    </header>
    <main id="conteudo" className="mx-auto max-w-[1500px] space-y-6 px-4 pb-16 pt-8 sm:px-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700"><CheckCircle2 size={14}/> Dados oficiais, sem simulações</span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink sm:text-4xl">Dinâmica econômica e empresarial</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">Canoas/RS em dados oficiais IBGE. A movimentação da JUCISRS é apresentada separadamente como contexto estadual. Os períodos e universos não são confundidos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-xl bg-white px-3 py-2 text-slate-600 ring-1 ring-slate-200">Coleta: {generated}</span>
          <button onClick={exportData} disabled={!data || (!data.cempre.length && !data.gdp.length && !data.rsBusiness.length)} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-40"><Download size={15}/> Exportar CSV</button>
        </div>
      </section>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {data?.quality.errors.length ? <details className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><summary className="cursor-pointer font-bold">Avisos de coleta ({data.quality.errors.length})</summary><ul className="mt-2 list-disc space-y-2 pl-5">{data.quality.errors.map((message, i) => <li key={i}>{message}</li>)}</ul></details> : null}
      <section id="canoas" className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-bold text-ink"><Landmark size={21} className="text-brand-700"/> Panorama de Canoas</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Card icon={<Building2 size={19}/>} label="Empresas e organizações" value={lastCempre && number.format(lastCempre.value)} note={"IBGE CEMPRE " + (lastCempre?.year ?? "—") + (hasNewCempre ? " · Série nova (2022+)." : " · Série antiga, até 2021.") + " Não são CNPJs atuais."}/>
          <Card icon={<TrendingUp size={19}/>} label="PIB municipal" value={lastGdp && money.format(lastGdp.value * 1000)} note={"IBGE " + (lastGdp?.year ?? "—") + " · Preços correntes, unidade original em mil reais."}/>
          <Card icon={<Users size={19}/>} label={hasPopulationEstimate ? "População estimada" : "População residente"} value={lastPopulation && number.format(lastPopulation.value)} note={"IBGE " + (hasPopulationEstimate ? "Estimativa" : "Censo") + " " + (lastPopulation?.year ?? "—") + ". " + (hasPopulationEstimate ? "Estimativa anual, não contagem censitária. Censo 2022: " + (censusPopulation ? number.format(censusPopulation.value) : "N/D") + "." : "Contagem censitária, distinta de estimativas.")}/>
        </div>
      </section>
      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <Panel title="Empresas e organizações no tempo" note="Séries separadas: 2006–2021 (tabela 993) e 2022 em diante (tabela 9582). Houve mudança metodológica em 2022; a transição não deve ser interpretada como crescimento.">
          {data?.cempre.length ? <div className="h-[280px] w-full" role="img" aria-label="Evolução anual de empresas e outras organizações de Canoas">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={data.cempre} margin={{ left: 0, right: 18, bottom: 4 }}><CartesianGrid vertical={false} stroke="#e3e9ed"/><XAxis dataKey="year" tick={{ fontSize: 11 }} minTickGap={18}/><YAxis width={60} tickFormatter={(v: number) => number.format(v)} tick={{ fontSize: 10 }}/><Tooltip formatter={(v) => number.format(Number(v))}/><Line dataKey="value" name="Organizações" stroke="#0b806a" strokeWidth={3}/></LineChart></ResponsiveContainer>
          </div> : <Empty label="Aguardando dados municipais CEMPRE."/>}
          {data?.cempreCurrent?.length ? <div className="mt-5 border-t border-slate-200 pt-4">
            <p className="mb-3 text-sm font-bold text-ink">Nova série metodológica — 2022 em diante</p>
            <div className="h-[210px] w-full" role="img" aria-label="Nova série oficial de organizações no CEMPRE a partir de 2022">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.cempreCurrent}>
                  <CartesianGrid vertical={false} stroke="#e3e9ed"/>
                  <XAxis dataKey="year" tick={{fontSize:11}}/>
                  <YAxis width={60} tick={{fontSize:10}} tickFormatter={(v:number)=>number.format(v)}/>
                  <Tooltip formatter={(v)=>number.format(Number(v))}/>
                  <Line dataKey="value" name="Organizações · nova série" stroke="#247f96" strokeWidth={3}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <SourceLink href="https://sidra.ibge.gov.br/tabela/9582">Fonte SIDRA 9582 · CEMPRE 2022+</SourceLink>
            <p className="mt-2 text-xs text-amber-800">Quebra estatística em 2022: não calcular a variação entre 2021 e 2022.</p>
          </div> : null}
          <SourceLink href="https://sidra.ibge.gov.br/tabela/993">Fonte histórica SIDRA 993</SourceLink>
        </Panel>
        <Panel title="Evolução do PIB municipal" note="PIB oficial mais recente disponível, a preços correntes, em bilhões de reais. Série nominal; não é crescimento real descontado da inflação.">
          {data?.gdp.length ? <div className="h-[280px] w-full" role="img" aria-label="Produto Interno Bruto anual de Canoas, fonte IBGE">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={data.gdp.map((r) => ({year: r.year, value: r.value / 1_000_000}))} margin={{ left: -8, right: 14, bottom: 4 }}><CartesianGrid vertical={false} stroke="#e3e9ed"/><XAxis dataKey="year" tick={{ fontSize: 11 }} minTickGap={18}/><YAxis width={58} tick={{ fontSize: 11 }}/><Tooltip formatter={(v) => money.format(Number(v)) + " bilhões"}/><Bar dataKey="value" name="PIB" fill="#0b806a" radius={[5, 5, 0, 0]}/></BarChart></ResponsiveContainer>
          </div> : <Empty label="Aguardando dados municipais do PIB."/>}
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            <strong>Aviso metodológico (IBGE):</strong> em 2022 e 2023, durante a reformulação das Contas Nacionais, foram adotados procedimentos especiais e não foi divulgada a abertura setorial tradicional do valor adicionado. A série referência 2010 será revista na nova referência 2021, prevista para 2027. Interprete comparações interanuais com ressalva; valores apresentados são nominais.
          </p>
          <SourceLink href="https://www.ibge.gov.br/estatisticas/economicas/contas-nacionais/9088-produto-interno-bruto-dos-municipios.html">Metodologia oficial PIB municipal · IBGE</SourceLink>
          <span className="ml-3"><SourceLink href="https://sidra.ibge.gov.br/tabela/5938">SIDRA 5938</SourceLink></span>
        </Panel>
      </div>
      <Panel title="Atividades econômicas por seção CNAE" note="Seções CNAE do CEMPRE no último ano disponível: usa 2022+ (tabela 9582) quando disponível; caso contrário, série antiga 2021 (tabela 993). Não é estoque CNPJ mensal.">
        <label className="block max-w-md text-xs font-semibold text-slate-600">Seção CNAE
          <select value={section} onChange={(e) => setSection(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">
            <option value="all">Todas as seções</option>{(data?.cnaeCurrent?.length ? data.cnaeCurrent : data?.cnae || []).map((r) => <option key={r.category} value={r.category}>{r.label}</option>)}
          </select>
        </label>
        {sections.length ? <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="h-[330px] w-full" role="img" aria-label="Ranking de setores econômicos CEMPRE 2021">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={sections.slice(0, 12).map((r) => ({ code: r.label.slice(0, 1), title: r.label, value: r.value }))} layout="vertical"><CartesianGrid horizontal={false} stroke="#e3e9ed"/><XAxis type="number" tick={{ fontSize: 11 }}/><YAxis type="category" dataKey="code" width={32} tick={{ fontSize: 11 }}/><Tooltip formatter={(v) => number.format(Number(v))} labelFormatter={(label, payload) => String(payload?.[0]?.payload?.title ?? label)}/><Bar dataKey="value" name="Organizações" fill="#247f96" radius={[0, 5, 5, 0]}/></BarChart></ResponsiveContainer>
          </div>
          <div className="max-h-[330px] overflow-y-auto">{sections.map((r) => <div key={r.category} className="flex justify-between gap-3 border-b border-slate-100 py-2.5 text-xs"><span className="text-slate-600">{r.label}</span><strong className="shrink-0 text-ink">{number.format(r.value)}</strong></div>)}</div>
        </div> : <div className="mt-4"><Empty label="Desagregação por CNAE indisponível: nenhum dado estimado."/></div>}
        <SourceLink href={data?.cnaeCurrent?.length ? "https://sidra.ibge.gov.br/tabela/9582" : "https://sidra.ibge.gov.br/tabela/993"}>Fonte SIDRA / CEMPRE</SourceLink>
      </Panel>
      <section id="rs" className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-bold text-ink"><Globe2 size={21} className="text-brand-700"/> Contexto estadual — RS</h2>
        <p className="text-sm text-slate-600">Movimentação empresarial registrada pela JUCISRS. <strong>Estes valores pertencem a todo o Rio Grande do Sul; não são números de Canoas.</strong></p>
        <Panel title="Movimentação empresarial do Rio Grande do Sul" note="Arquivos públicos Dados RS/JUCISRS (CC0-1.0). Meses sem observações não são tratados como zero.">
          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">Modalidade
              <select value={kind} onChange={(e) => setKind(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">{Object.entries(groupNames).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select>
            </label>
            <label className="text-xs font-semibold text-slate-600">Ano de referência
              <select value={selectedYear} onChange={(e) => setYear(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">{years.map((y) => <option value={y} key={y}>{y}</option>)}</select>
            </label>
          </div>
          {rs.length ? <>
            <div className="mb-4 flex flex-wrap gap-6 rounded-xl bg-slate-50 p-4"><div><p className="text-xs text-slate-500">Total de meses publicados</p><p className="text-2xl font-extrabold text-ink">{number.format(yearTotal)}</p></div><div><p className="text-xs text-slate-500">Cobertura</p><p className="text-2xl font-extrabold text-ink">{rs.length}/12 meses</p></div></div>
            <div className="h-[290px] w-full" role="img" aria-label="Registros da JUCISRS no estado do Rio Grande do Sul"><ResponsiveContainer width="100%" height="100%"><BarChart data={rs} margin={{ left: -4, right: 15 }}><CartesianGrid vertical={false} stroke="#e3e9ed"/><XAxis dataKey="label" tick={{ fontSize: 11 }}/><YAxis tickFormatter={(v: number) => number.format(v)} tick={{ fontSize: 10 }} width={64}/><Tooltip formatter={(v) => number.format(Number(v))}/><Bar dataKey="value" name="Registros no RS" fill="#247f96" radius={[5, 5, 0, 0]}/></BarChart></ResponsiveContainer></div>
            <p className="mt-3 text-xs text-slate-500">Soma apenas meses com dados publicados. Não corresponde necessariamente ao total do ano completo.</p>
            <SourceLink href={rs.at(-1)?.sourceUrl || "https://dados.rs.gov.br/dataset/empresas-constituidas"}>CSV original Dados RS</SourceLink>
          </> : <Empty label="Não há registros publicados para esta seleção."/>}
        </Panel>
      </section>
      <Panel id="mapa" title="Território de Canoas" note="Mapa de base OpenStreetMap e limite municipal oficial do IBGE. Sem pontos empresariais simulados."><OfficialMap/></Panel>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-brand-50 p-5"><p className="flex items-center gap-2 font-bold text-brand-900"><Landmark size={18}/> Fontes e universos</p><p className="mt-2 text-sm leading-relaxed text-brand-900">CEMPRE, PIB, Censo e JUCISRS não representam o mesmo universo ou período. Não calculamos saldo municipal a partir de totais estaduais.</p><Link href="/sobre" className="mt-3 inline-block text-sm font-semibold text-brand-700 underline">Consultar metodologia →</Link></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="flex items-center gap-2 font-bold text-ink"><Database size={18} className="text-brand-700"/> Atualização pelo GitHub</p><p className="mt-2 text-sm leading-relaxed text-slate-600">Indicadores coletados pelo GitHub Actions. Origem, referência e eventuais falhas são registrados no JSON publicado.</p><Link href="/atualizacao" className="mt-3 inline-block text-sm font-semibold text-brand-700 underline">Como atualizar →</Link></div>
      </div>
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-xs">
        <strong className="w-full text-ink">Fontes carregadas:</strong>
        {(data?.sources || []).map((r, i) => <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700 hover:bg-slate-200">{r.name} · {r.territory === "43" ? "RS" : "Canoas"} ↗</a>)}
      </div>
    </main>
    <footer className="border-t border-slate-200 bg-white p-6 text-center text-xs text-slate-500">Canoas Empreende · Código aberto MIT · IBGE e Dados RS/JUCISRS · <a href="https://github.com/marcianolima/webgis-empreender-canoas" target="_blank" rel="noopener noreferrer" className="underline">GitHub</a></footer>
  </>;
}
