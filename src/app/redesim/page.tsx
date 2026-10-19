import type { Metadata } from "next";
import data from "@/data/external-indicators.json";
import { RedesimDashboard } from "@/components/redesim-dashboard";
import type { ExternalIndicatorRecord } from "@/lib/external-sources";

export const metadata: Metadata={title:"REDESIM e Abertura de Empresas | Canoas Empreende",description:"Indicadores processuais de abertura, registro e viabilidade com fontes oficiais da REDESIM e Mapa de Empresas."};
export default function RedesimPage(){
  const records=data.records as ExternalIndicatorRecord[];
  return <main className="mx-auto max-w-[1450px] px-4 py-8 text-ink sm:px-6 sm:py-12">
    <div className="mt-7">
      <span className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">Mapa de Empresas · REDESIM · JucisRS</span>
      <h1 className="mt-3 text-2xl font-extrabold sm:text-4xl">Ambiente de abertura e legalização</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">Prazos processuais, registro e viabilidade de empresas em Canoas. Indicadores somente quando a exportação oficial por município estiver disponível e auditada.</p>
    </div>
    <RedesimDashboard records={records}/>
  </main>;
}
