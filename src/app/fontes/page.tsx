import type { Metadata } from "next";
import data from "@/data/external-indicators.json";
import { ExternalDataPanel } from "@/components/external-data-panel";
import type { ExternalIndicatorRecord } from "@/lib/external-sources";

export const metadata: Metadata = {
  title: "Fontes complementares | Canoas Empreende",
  description: "Integração rastreável com DataSebrae, RS em Dados, Mapa de Empresas e Dados RS.",
};

export default function FontesPage() {
  // O JSON publicado inicia sem registros e só muda após ingestão validada.
  const records = data.records as ExternalIndicatorRecord[];
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-7 mt-7">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Inteligência econômica</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink sm:text-4xl">Fontes complementares</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
          Catálogo de painéis públicos e infraestrutura para incorporar indicadores de Canoas e do Rio Grande do Sul
          com rastreabilidade. Fontes catalogadas não significam dados importados.
        </p>
      </div>
      <ExternalDataPanel records={records} generatedAt={data.generated_at}/>
      <footer className="mt-10 border-t border-slate-200 pt-6 text-xs leading-relaxed text-slate-500">
        Os dados oficiais devem observar termos de reutilização, filtros, data de extração, versão e diferenças de universo.
        Dados demonstrativos do painel principal não são utilizados nesta página.
      </footer>
    </main>
  );
}
