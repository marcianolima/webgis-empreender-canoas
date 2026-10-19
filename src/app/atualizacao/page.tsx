export const metadata = { title: "Atualização dos dados | Canoas Empreende" };
export default function Atualizacao() {
  return <main className="mx-auto max-w-3xl px-5 py-12 text-ink">
    <h1 className="mt-8 text-3xl font-extrabold">Coleta de dados oficiais</h1>
    <p className="mt-4 leading-relaxed text-slate-600">O processo é executado inteiramente pelo GitHub Actions na publicação e em rotinas programadas. O script Python utiliza APIs do IBGE e do Dados RS/JUCISRS e produz JSON e GeoJSON estáticos para o GitHub Pages.</p>
    <ol className="mt-6 list-decimal space-y-3 pl-6 leading-relaxed text-slate-700">
      <li>Coleta IBGE/SIDRA: CEMPRE (série histórica), PIB e população de Canoas, identificador 4304606.</li>
      <li>Obtém a malha territorial oficial por API IBGE.</li>
      <li>Consulta catálogo CKAN do Dados RS e CSVs JUCISRS identificados como informações estaduais.</li>
      <li>Confere integridade territorial, unidades, ausência de meses e registra falhas de fontes.</li>
      <li>Executa testes, checagem TypeScript, lint, build Next.js estático e publicação no GitHub Pages.</li>
    </ol>
    <h2 className="mt-8 text-xl font-bold">Limites atuais</h2>
    <p className="mt-2 leading-relaxed text-slate-600">O processamento integral de arquivos nacionais da Receita Federal não integra a coleta leve. Portanto, abertura/baixa de CNPJ por mês em Canoas, MEI por bairro, geocodificação e endereços não são estimados.</p>
    <a className="mt-6 inline-block text-sm font-semibold text-brand-700 underline" href="https://github.com/marcianolima/webgis-empreender-canoas/actions" target="_blank" rel="noopener noreferrer">Ver GitHub Actions</a>
  </main>;
}
