import Link from "next/link";

export const metadata = { title: "Sobre e metodologia | Canoas Empreende" };

export default function Sobre() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 text-ink">
      <Link href="/" className="text-sm font-semibold text-brand-700">← Voltar ao observatório</Link>
      <h1 className="mt-8 text-3xl font-extrabold">Sobre o Canoas Empreende</h1>
      <p className="mt-4 leading-relaxed text-slate-600">Observatório WebGIS de dinâmica empresarial em Canoas/RS. A etapa atual é um protótipo demonstrativo com registros e coordenadas inteiramente fictícios. Não há, neste momento, estatísticas municipais homologadas.</p>
      <h2 className="mt-8 text-xl font-bold">Fontes oficiais previstas</h2>
      <p className="mt-2 leading-relaxed text-slate-600">A base principal será a Receita Federal (dados abertos do CNPJ). IBGE, GeoCanoas, Prefeitura de Canoas, OpenStreetMap e Mapa de Empresas serão utilizados como complementos, sujeitos à validação, compatibilidade metodológica e condições de uso.</p>
      <h2 className="mt-8 text-xl font-bold">Interpretação dos indicadores</h2>
      <p className="mt-2 leading-relaxed text-slate-600">A unidade de contagem é o estabelecimento CNPJ (inclui matriz e filiais). Ativo significa situação cadastral 02 no período de referência. Aberturas utilizam data de início de atividade; baixas usam situação 08 e data da situação. Retratos cadastrais não são histórico exaustivo de eventos, e o saldo não necessariamente equivale à variação do estoque.</p>
      <h2 className="mt-8 text-xl font-bold">Geocodificação e qualidade</h2>
      <p className="mt-2 leading-relaxed text-slate-600">Endereço cadastral não confirma localização da atividade. Cada coordenada deverá ter método e confiança documentados, com taxa de cobertura, validação territorial e ressalva quando aproximada. A geocodificação real ainda não foi realizada.</p>
      <h2 className="mt-8 text-xl font-bold">Transparência, licenças e privacidade</h2>
      <p className="mt-2 leading-relaxed text-slate-600">O código utiliza MIT; as fontes externas têm termos próprios. A publicação de dados individualizados, especialmente os de empresários individuais, requer avaliação de privacidade, minimização e finalidade pública. Não serão incluídos dados de sócios e CPF.</p>
      <p className="mt-8 text-sm text-slate-500">Consulte a documentação técnica completa no <a className="underline" href="https://github.com/marcianolima/webgis-empreender-canoas/tree/main/docs">repositório GitHub</a>.</p>
    </main>
  );
}
