"use client";

import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { SECTORS, NEIGHBORHOODS } from "@/data/demo";
import { useFilters } from "@/store/use-filters";
import type { BusinessFilters } from "@/types/establishment";
import { Button } from "@/components/ui/button";

function FilterSelect<K extends keyof BusinessFilters>({
  name, label, options, value,
}: {
  name: K;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  const setFilter = useFilters((state) => state.setFilter);
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => setFilter(name, event.target.value as BusinessFilters[K])}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-ink shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Filters() {
  const filters = useFilters((state) => state.filters);
  const setFilter = useFilters((state) => state.setFilter);
  const clearFilters = useFilters((state) => state.clearFilters);
  return (
    <aside aria-label="Filtros integrados de dados" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink"><SlidersHorizontal size={18} className="text-brand-600" /> Filtros</h2>
        <Button type="button" variant="ghost" size="sm" onClick={clearFilters}><RotateCcw size={14} /> Limpar</Button>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-slate-500">O recorte selecionado atualiza os gráficos e o mapa ao mesmo tempo.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Pesquisar identificação fictícia</span>
          <span className="relative block"><Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
            <input value={filters.query} onChange={(event) => setFilter("query", event.target.value)} placeholder="Nome ou código DEMO" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500" />
          </span>
        </label>
        <FilterSelect name="period" label="Abertura do estabelecimento" value={filters.period} options={[
          { value: "all", label: "Todo o período da amostra" },
          { value: "3", label: "Últimos 3 meses" },
          { value: "6", label: "Últimos 6 meses" },
          { value: "12", label: "Últimos 12 meses" },
        ]} />
        <FilterSelect name="sector" label="Setor econômico" value={filters.sector} options={[{ value: "", label: "Todos os setores" }, ...SECTORS.map((s) => ({ value: s.code, label: s.label }))]} />
        <FilterSelect name="porte" label="Porte da empresa" value={filters.porte} options={[
          { value: "", label: "Todos os portes" }, { value: "01", label: "Microempresa" },
          { value: "03", label: "Pequeno porte" }, { value: "05", label: "Demais" },
        ]} />
        <FilterSelect name="status" label="Situação cadastral" value={filters.status} options={[
          { value: "", label: "Ativos e baixados" }, { value: "02", label: "Ativos" }, { value: "08", label: "Baixados" },
        ]} />
        <FilterSelect name="bairro" label="Bairro (amostra)" value={filters.bairro} options={[
          { value: "", label: "Todos os bairros" },
          ...NEIGHBORHOODS.map((name) => ({ value: name, label: name })),
        ]} />
      </div>
      <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-medium text-ink">
        <input type="checkbox" checked={filters.meiOnly} onChange={(event) => setFilter("meiOnly", event.target.checked)}
          className="h-4 w-4 accent-emerald-700" />
        Somente MEI (demonstração)
      </label>
      <p className="mt-4 text-xs leading-relaxed text-amber-800">Os dados exibidos são sintéticos. Nenhum número é estatística oficial.</p>
    </aside>
  );
}
