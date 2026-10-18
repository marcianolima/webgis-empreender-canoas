import Link from "next/link";

export const metadata = { title: "Atualização de dados | Canoas Empreende" };

export default function Atualizacao() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 text-ink">
      <Link href="/" className="text-sm font-semibold text-brand-700">← Voltar ao observatório</Link>
      <h1 className="mt-8 text-3xl font-extrabold">Como os dados serão atualizados</h1>
      <p className="mt-4 leading-relaxed text-slate-600">O processo mensal ainda não está automatizado. A versão demonstrativa não consulta o CNPJ e não apresenta números oficiais.</p>
      <ol className="mt-6 list-decimal space-y-3 pl-6 leading-relaxed text-slate-700">
        <li>Consultar o lote mensal público da Receita Federal e registrar a competência.</li>
        <li>Baixar todos os arquivos de Empresas e Estabelecimentos, além de Simples e tabelas auxiliares quando disponíveis.</li>
        <li>Filtrar Canoas pelo código próprio de município da Receita e unir as tabelas por CNPJ básico.</li>
        <li>Conferir duplicidades, situações, dados faltantes e integridade dos arquivos.</li>
        <li>Geocodificar endereços com método, confiança e auditoria, respeitando privacidade e direitos de uso.</li>
        <li>Gerar agregados e dados cartográficos, validar indicadores e publicar nova competência.</li>
      </ol>
      <p className="mt-6 leading-relaxed text-slate-600">A ingestão inicial em Python está disponível no repositório. Como ponto de partida, os arquivos são transformados em CSV local, sem publicação automática de dados individuais.</p>
      <a href="https://github.com/marcianolima/webgis-empreender-canoas/blob/main/docs/atualizacao-mensal.md" className="mt-6 inline-block font-semibold text-brand-700 underline">Abrir procedimento técnico completo</a>
    </main>
  );
}
