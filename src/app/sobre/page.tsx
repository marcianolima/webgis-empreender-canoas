import Link from "next/link";
export const metadata = { title: "Metodologia | Canoas Empreende" };
export default function Sobre() {
  return <main className="mx-auto max-w-3xl px-5 py-12 text-ink">
    <h1 className="mt-8 text-3xl font-extrabold">Sobre, metodologia e limitações</h1>
    <p className="mt-4 leading-relaxed text-slate-600">Observatório WebGIS estático de Canoas, baseado exclusivamente em dados oficiais agregados. O site é gerado pelo GitHub Actions e servido pelo GitHub Pages. Nenhuma estatística ou coordenada fictícia é publicada.</p>
    <h2 className="mt-8 text-xl font-bold">Empresas — CEMPRE</h2>
    <p className="mt-2 leading-relaxed text-slate-600">Empresas e outras organizações por ano na tabela <a className="text-brand-700 underline" href="https://sidra.ibge.gov.br/tabela/993">993 do SIDRA/IBGE</a>, cuja série municipal foi encerrada em 2021. A nova tabela 9582 cobre 2022 em diante e utiliza critérios diferentes: nenhuma variação 2021–2022 pode ser calculada diretamente. Esse universo estatístico não corresponde ao estoque mensal de estabelecimentos CNPJ ativos. As seções CNAE provêm da mesma tabela.</p>
    <h2 className="mt-8 text-xl font-bold">PIB e população</h2>
    <p className="mt-2 leading-relaxed text-slate-600">PIB municipal a preços correntes na tabela <a className="text-brand-700 underline" href="https://sidra.ibge.gov.br/tabela/5938">5938 do IBGE</a>, divulgado em mil reais, multiplicado por mil no cartão. O IBGE informa ressalvas aos resultados de 2022 e 2023 decorrentes da reformulação das contas nacionais (ano-base 2010), sem abertura setorial completa nesses anos, e revisão prevista para 2027 na referência 2021. Séries nominais não medem crescimento real. População do Censo 2022, tabela <a className="text-brand-700 underline" href="https://sidra.ibge.gov.br/tabela/4714">4714</a>.</p>
    <h2 className="mt-8 text-xl font-bold">Movimentação estadual JUCISRS</h2>
    <p className="mt-2 leading-relaxed text-slate-600">Constituições, extinções e movimentos de filiais dos CSVs da <a className="text-brand-700 underline" href="https://dados.rs.gov.br/dataset/empresas-constituidas">JUCISRS / Dados RS</a> (licença CC0-1.0). Esses arquivos fornecem totais estaduais, não dados exclusivos de Canoas. Meses com valores em branco não viram zeros, e somas parciais não são descritas como anos completos.</p>
    <h2 className="mt-8 text-xl font-bold">Mapa oficial e limites</h2>
    <p className="mt-2 leading-relaxed text-slate-600">Malha territorial oficial do IBGE para município 4304606 e mapa-base OpenStreetMap com atribuição. Ainda não há registros de estabelecimentos geocodificados: por isso não existem pontos empresariais nesta versão. A ingestão mensal completa do CNPJ da Receita Federal e geocodificação exigem validação de cobertura, confidencialidade, termos e LGPD.</p>
    <p className="mt-8 text-sm"><Link href="/fontes" className="font-semibold text-brand-700 underline">Fontes adicionais: DataSebrae, Mapa de Empresas e RS em Dados →</Link></p>
  </main>;
}

