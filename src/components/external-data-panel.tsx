"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, ChartColumn, Database, FileCheck2, Info, Link2, MapPin, ShieldCheck } from "lucide-react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  EXTERNAL_SOURCES, INDICATOR_LABELS, formatIndicator, territoryName,
  type ExternalIndicatorRecord, type ExternalSourceId, type IndicatorId,
} from "@/lib/external-sources";

const SOURCE_NOTES: Partial<Record<ExternalSourceId, string>> = {
  datasebrae_aberturas: "Não comparar diretamente com abertura de estabelecimentos (matriz + filiais) sem harmonizar universo, filtros e competência.",
  datasebrae_tempo: "Tempo de processamento, não a jornada completa do empreendedor. Observar mudança metodológica nacional em dez/2025.",
  rs_em_dados: "Fontes, granularidades e períodos variam conforme cada painel. Nem todo indicador está disponível por município.",
  mapa_empresas: "O governo disponibiliza extração guiada. Em tempo de abertura, MEI não compõe o cálculo e houve mudança metodológica em dez/2025.",
  dados_rs: "Estatísticas de registros na JUCISRS não equivalem automaticamente ao movimento cadastral de todos os CNPJs.",
};

function LinkExternal({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-brand-700 underline-offset-4 hover:underline focus-visible:rounded-sm">
      {children}<ArrowUpRight size={15} aria-hidden="true" />
    </a>
  );
}

export function ExternalDataPanel({ records, generatedAt }: {
  records: ExternalIndicatorRecord[];
  generatedAt: string | null;
}) {
  const [selectedSource, setSelectedSource] = useState<ExternalSourceId>("datasebrae_aberturas");
  const [indicatorSelection, setIndicatorSelection] = useState<IndicatorId | "">("");
  const [geography, setGeography] = useState<"4304606" | "43">("4304606");
  const source = EXTERNAL_SOURCES.find((item) => item.id === selectedSource)!;
  const fromSource = useMemo(() => records.filter((row) => row.fonte === selectedSource), [records, selectedSource]);
  const indicators = useMemo(() =>
    Array.from(new Set(fromSource.map((row) => row.indicador))).sort(), [fromSource]
  );
  const metric = indicatorSelection && indicators.includes(indicatorSelection)
    ? indicatorSelection : (indicators[0] ?? "");
  const series = useMemo(() => fromSource
    .filter((row) => row.indicador === metric && row.territorio === geography)
    .sort((a, b) => a.competencia.localeCompare(b.competencia)), [fromSource, metric, geography]);
  const reference = series.length ? series[series.length - 1] : null;
  const distinctSources = new Set(records.map((row) => row.fonte)).size;
  const sourceTotals = useMemo(() => Object.fromEntries(EXTERNAL_SOURCES.map((item) => [
    item.id, records.filter((row) => row.fonte === item.id).length,
  ])), [records]);

  // As categorias de universo, segmento e unidade nunca devem ser somadas
  // implicitamente. Semânticas distintas recebem séries separadas.
  const compatibleSeries = useMemo(() => {
    if (!reference) return [];
    return series.filter((row) =>
      row.unidade === reference.unidade &&
      row.universo === reference.universo &&
      row.segmento === reference.segmento
    );
  }, [series, reference]);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Panorama das integrações complementares">
        {[
          { icon: <Database size={19}/>, value: String(EXTERNAL_SOURCES.length), label: "Fontes catalogadas" },
          { icon: <FileCheck2 size={19}/>, value: String(distinctSources), label: "Fontes com dados importados" },
          { icon: <ChartColumn size={19}/>, value: String(records.length), label: "Observações verificáveis" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
            <div className="flex items-center justify-between text-slate-500"><p className="text-xs font-semibold uppercase tracking-wide">{item.label}</p><span className="text-brand-700">{item.icon}</span></div>
            <p className="mt-2 text-3xl font-bold text-ink">{item.value}</p>
          </div>
        ))}
      </section>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
        <nav aria-label="Selecionar fonte pública" className="flex flex-col gap-2">
          {EXTERNAL_SOURCES.map((item) => {
            const selected = item.id === selectedSource;
            const number = sourceTotals[item.id] ?? 0;
            return (
              <button key={item.id} type="button" aria-current={selected ? "page" : undefined}
                onClick={() => { setSelectedSource(item.id); setIndicatorSelection(""); }}
                className={"w-full rounded-2xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-brand-600 " +
                  (selected ? "border-brand-400 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-200")}>
                <span className="block text-xs font-semibold text-slate-500">{item.organization}</span>
                <span className="mt-1 block text-sm font-bold text-ink">{item.name}</span>
                <span className="mt-1 block text-xs text-slate-500">{number ? number + " observações importadas" : "Aguardando dados estruturados"}</span>
              </button>
            );
          })}
        </nav>

        <section aria-label={"Detalhes de " + source.name} className="min-w-0 space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-700">{source.organization}</p>
            <h2 className="mt-1 text-xl font-bold text-ink">{source.name}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{source.description}</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-700"><strong>Utilização:</strong> {source.purpose}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500"><strong>Integração:</strong> {source.approach}</p>
            <div className="mt-4"><LinkExternal url={source.url}>Consultar painel original</LinkExternal></div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-ink">Indicadores comparáveis</h3>
                <p className="mt-1 text-xs text-slate-500">Série por competência, universo e segmento idênticos.</p>
              </div>
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <ShieldCheck size={16} className="text-brand-700" />
                {generatedAt ? "Última importação " + generatedAt.slice(0, 10) : "Sem importação oficial"}
              </span>
            </div>
            {indicators.length > 0 ? (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Indicador</span>
                    <select value={metric} onChange={(e) => setIndicatorSelection(e.target.value as IndicatorId)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus-visible:ring-2 focus-visible:ring-brand-600">
                      {indicators.map((id) => <option value={id} key={id}>{INDICATOR_LABELS[id]}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Recorte territorial</span>
                    <select value={geography} onChange={(e) => setGeography(e.target.value as "4304606" | "43")}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus-visible:ring-2 focus-visible:ring-brand-600">
                      <option value="4304606">Canoas</option>
                      <option value="43">Rio Grande do Sul</option>
                    </select>
                  </label>
                </div>
                {reference ? (
                  <>
                    <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-brand-50 px-4 py-3">
                      <div><p className="text-xs font-semibold text-slate-500">Valor publicado mais recente ({reference.competencia})</p>
                        <p className="text-2xl font-extrabold text-ink">{formatIndicator(reference.valor, reference.unidade)}</p>
                      </div>
                      <div className="min-w-0 text-xs text-slate-600"><p><strong>Universo:</strong> {reference.universo}</p><p><strong>Segmento:</strong> {reference.segmento || "Total"}</p><p><strong>Recorte:</strong> {territoryName(reference.territorio)}</p></div>
                    </div>
                    {series.length !== compatibleSeries.length && (
                      <p className="mt-3 text-xs text-amber-800">Outras observações deste indicador têm universo, segmento ou unidade diferentes e foram excluídas deste gráfico. Consulte a tabela de origem para uma comparação válida.</p>
                    )}
                    <div className="mt-5 h-[265px] w-full" role="img" aria-label={"Série temporal de " + INDICATOR_LABELS[metric as IndicatorId]}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={compatibleSeries} margin={{ top: 6, right: 20, bottom: 8, left: 5 }}>
                          <CartesianGrid vertical={false} stroke="#e5eaf0"/>
                          <XAxis dataKey="competencia" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} width={55}/>
                          <Tooltip formatter={(value) => typeof value === "number" ? formatIndicator(value, reference.unidade) : String(value)} />
                          <Legend/>
                          <Line name={INDICATOR_LABELS[metric as IndicatorId]} type="monotone" dataKey="valor" stroke="#087f66" strokeWidth={3}/>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Extraído em {reference.extraido_em}. <LinkExternal url={reference.url_origem}>Fonte desta observação</LinkExternal></p>
                  </>
                ) : (
                  <div className="mt-5 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-600"><MapPin size={22} className="mx-auto mb-2 text-slate-400" />Nenhum registro disponível para {territoryName(geography)} nesta seleção.</div>
                )}
              </>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                <Database size={26} className="mx-auto text-slate-400"/>
                <h4 className="mt-3 text-base font-bold text-ink">Dados ainda não importados</h4>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
                  O painel de origem está catalogado, mas não há arquivo estruturado auditado para Canoas. Os indicadores aparecerão após a importação documentada, sem valores inventados.
                </p>
                <div className="mt-4 text-sm"><a className="font-semibold text-brand-700 underline" href="https://github.com/marcianolima/webgis-empreender-canoas/blob/main/docs/fontes-complementares.md" target="_blank" rel="noopener noreferrer">Como integrar os dados</a></div>
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><Info size={17} className="text-brand-700"/> Interpretação e limitações</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{SOURCE_NOTES[selectedSource] ?? "Fonte oficial catalogada. A integração numérica requer download/API verificável, recorte municipal e licença de reutilização."}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500"><Link2 size={13} className="mr-1 inline"/> Indicadores externos não são misturados automaticamente com a base individual de estabelecimentos CNPJ. Filtros CNAE e de bairro do protótipo não se aplicam aos dados importados sem campos compatíveis.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
