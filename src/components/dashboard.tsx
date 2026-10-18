"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, Building2, ChartColumn, CircleHelp,
  Database, MapPinned, TrendingUp, WalletCards,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { DEMO_BUSINESSES, DEMO_REFERENCE } from "@/data/demo";
import { Filters } from "@/components/filters";
import { Button } from "@/components/ui/button";
import { businessStats, filteredBusinesses, formatNumber } from "@/lib/business-stats";
import { useFilters } from "@/store/use-filters";
import type { ReactNode } from "react";

const BusinessMap = dynamic(() => import("@/components/business-map"), {
  ssr: false,
  loading: () => <div className="flex h-[340px] items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">Carregando mapa…</div>,
});

const COLORS = ["#0b806a", "#439bcb", "#eba94b", "#7c70b9", "#59a69c", "#f07d65"];
const shortDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" })
  .format(new Date(DEMO_REFERENCE + "T12:00:00Z"));

function Panel({ title, subtitle, children, id }: { title: string; subtitle?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {subtitle && <p className="mt-1 text-xs leading-relaxed text-slate-500">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Metric({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <div className="flex items-center justify-between gap-2 text-slate-500">
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
        <span className="rounded-lg bg-brand-50 p-2 text-brand-700">{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{value}</div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{note}</p>
    </div>
  );
}

export function Dashboard() {
  const filters = useFilters((state) => state.filters);
  const mode = useFilters((state) => state.mapMode);
  const setMode = useFilters((state) => state.setMapMode);
  const rows = useMemo(() => filteredBusinesses(DEMO_BUSINESSES, filters), [filters]);
  const stats = useMemo(() => businessStats(rows), [rows]);
  const pieData = stats.porPorte;
  const topSectors = stats.porSetor.slice(0, 6);
  const topNeighborhoods = stats.porBairro.slice(0, 7);

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white"><MapPinned size={22} /></span>
            <div>
              <p className="text-lg font-extrabold leading-tight tracking-tight text-ink">Canoas <span className="text-brand-600">Empreende</span></p>
              <p className="text-xs text-slate-500">Observatório de Desenvolvimento Econômico</p>
            </div>
          </div>
          <div className="flex gap-2 text-sm">
            <a className="rounded-lg px-3 py-2 font-semibold text-brand-700 hover:bg-brand-50" href="#visao-geral">Painel</a>
            <a className="rounded-lg px-3 py-2 font-semibold text-slate-600 hover:bg-slate-50" href="#mapa">Mapa</a>
            <a className="rounded-lg px-3 py-2 font-semibold text-slate-600 hover:bg-slate-50" href="/sobre">Sobre</a>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1600px] px-4 pb-16 pt-7 sm:px-6">
        <div className="mb-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">
            <CircleHelp size={14} /> AMBIENTE DEMONSTRATIVO — DADOS FICTÍCIOS
          </div>
          <h1 className="max-w-3xl text-2xl font-extrabold tracking-tight text-ink sm:text-3xl lg:text-4xl">Dinâmica empresarial de Canoas</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
            Explore a estrutura prevista para o observatório. A base exibida é totalmente sintética, com referência simulada em {shortDate}.
            Indicadores oficiais serão publicados somente após validação da Receita Federal.
          </p>
        </div>
        <main className="grid gap-5 lg:grid-cols-[270px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="min-w-0 lg:sticky lg:top-4 lg:self-start"><Filters /></div>
          <div className="min-w-0 space-y-5">
            <section id="visao-geral" aria-label="Indicadores principais">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-xl font-bold text-ink"><Activity size={19} className="text-brand-600" /> Visão geral</h2>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">{formatNumber(rows.length)} registros fictícios no filtro</span>
              </div>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                <Metric icon={<Building2 size={18} />} label="Ativos" value={formatNumber(stats.ativos)} note="Situação 02 no recorte selecionado" />
                <Metric icon={<ArrowUpRight size={18} />} label="Aberturas no mês" value={formatNumber(stats.abertasMes)} note="Mês 09/2026, data de início" />
                <Metric icon={<TrendingUp size={18} />} label="Aberturas no ano" value={formatNumber(stats.abertasAno)} note="Ano 2026, data de início" />
                <Metric icon={<ArrowDownRight size={18} />} label="Baixas no ano" value={formatNumber(stats.baixasAno)} note="Ano 2026, situação 08" />
                <Metric icon={<ChartColumn size={18} />} label="Saldo no ano" value={(stats.saldo >= 0 ? "+" : "") + formatNumber(stats.saldo)} note="Aberturas menos baixas simuladas" />
                <Metric icon={<WalletCards size={18} />} label="MEI entre ativos" value={stats.meiPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%"} note="MEIs / ativos do recorte" />
              </div>
            </section>
            <div className="grid min-w-0 gap-5 xl:grid-cols-2">
              <Panel title="Movimentação mensal" subtitle="Registros ilustrativos por data de abertura e baixa; outubro/2025 a setembro/2026.">
                <div className="h-[260px] w-full" role="img" aria-label="Gráfico de linhas com aberturas e baixas mensais simuladas">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.mensal} margin={{ top: 8, right: 10, left: -24, bottom: 4 }}>
                      <CartesianGrid vertical={false} stroke="#e4e9ee" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                      <Line name="Aberturas" type="monotone" dataKey="aberturas" stroke="#0b806a" strokeWidth={2.5} dot={false} />
                      <Line name="Baixas" type="monotone" dataKey="baixas" stroke="#e99742" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
              <Panel title="Distribuição por porte" subtitle="Participação entre estabelecimentos ativos da amostra filtrada.">
                <div className="h-[260px] w-full" role="img" aria-label="Gráfico de setores de porte empresarial simulado">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={pieData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={3}>
                      {pieData.map((entry, i) => <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />)}
                    </Pie><Tooltip /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} /></PieChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
              <Panel title="Principais setores" subtitle="Ranking de estabelecimentos ativos segundo seção CNAE simulada.">
                <div className="h-[280px] w-full" role="img" aria-label="Barras horizontais dos principais setores fictícios">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topSectors} layout="vertical" margin={{ left: 12, right: 20, top: 0, bottom: 0 }}>
                      <CartesianGrid horizontal={false} stroke="#e4e9ee" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={112} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="value" name="Ativos" fill="#0b806a" radius={[0, 5, 5, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
              <Panel title="Bairros com mais estabelecimentos" subtitle="Ranking pelo bairro atribuído a cada registro fictício, não por endereço comprovado.">
                <div className="h-[280px] w-full" role="img" aria-label="Barras horizontais dos bairros com maior número de registros fictícios">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topNeighborhoods} layout="vertical" margin={{ left: 12, right: 20 }}>
                      <CartesianGrid horizontal={false} stroke="#e4e9ee" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={108} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="value" name="Ativos" fill="#439bcb" radius={[0, 5, 5, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>
            <Panel id="mapa" title="Mapa de distribuição ilustrativa" subtitle="Agrupamento de pontos ou superfície de calor. Coordenadas simuladas, não representam locais de empresas reais.">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500">{formatNumber(rows.length)} pontos na seleção, inclusive registros baixados</span>
                <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Modo de representação cartográfica">
                  <Button size="sm" variant={mode === "points" ? "default" : "ghost"} aria-pressed={mode === "points"} onClick={() => setMode("points")}>Clusters</Button>
                  <Button size="sm" variant={mode === "heatmap" ? "default" : "ghost"} aria-pressed={mode === "heatmap"} onClick={() => setMode("heatmap")}>Calor</Button>
                </div>
              </div>
              <BusinessMap businesses={rows} mode={mode} />
              <p className="mt-3 text-xs text-slate-500">Base cartográfica © contribuidores do OpenStreetMap. Camada empresarial exclusivamente demonstrativa.</p>
            </Panel>
            <div className="flex flex-col gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-brand-900"><Database size={16} /> Metodologia e qualidade</p>
                <p className="mt-1 text-xs leading-relaxed text-brand-900">Saiba como a versão oficial utilizará dados CNPJ, geocodificação e indicadores auditáveis.</p>
              </div>
              <a href="/sobre" className="shrink-0 rounded-xl bg-white px-4 py-2 text-center text-sm font-semibold text-brand-700 shadow-sm ring-1 ring-brand-100 hover:bg-slate-50">Ver metodologia</a>
            </div>
          </div>
        </main>
      </div>
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        Canoas Empreende · Software aberto (MIT) · Protótipo com dados exclusivamente sintéticos · <a className="underline" href="/atualizacao">Atualização dos dados</a>
      </footer>
    </>
  );
}
