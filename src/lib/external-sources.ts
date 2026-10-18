export type ExternalSourceId =
  | "datasebrae_aberturas"
  | "datasebrae_tempo"
  | "rs_em_dados"
  | "mapa_empresas"
  | "dados_rs";

export type IndicatorId =
  | "aberturas"
  | "baixas"
  | "ativas"
  | "tempo_abertura_horas"
  | "tempo_viabilidade_horas"
  | "tempo_registro_horas"
  | "pib_brl"
  | "empregos_formais"
  | "exportacoes_usd";

export type Territory = "4304606" | "43";

export type ExternalIndicatorRecord = {
  fonte: ExternalSourceId;
  indicador: IndicatorId;
  competencia: string;
  territorio: Territory;
  valor: number;
  unidade: "estabelecimentos" | "empresas" | "horas" | "BRL" | "USD" | "vinculos";
  universo: string;
  segmento: string;
  extraido_em: string;
  url_origem: string;
  metodologia: string;
};

export const EXTERNAL_SOURCES: {
  id: ExternalSourceId;
  name: string;
  organization: string;
  url: string;
  description: string;
  purpose: string;
  approach: string;
}[] = [
  {
    id: "datasebrae_aberturas",
    name: "Abertura de Empresas",
    organization: "DataSebrae",
    url: "https://datasebrae.com.br/aberturadeempresas/",
    description: "Dinâmica de abertura por território, CNAE e perfil empresarial.",
    purpose: "Confrontar tendências de empreendedorismo e composição de novos negócios.",
    approach: "Consulta externa. Importação apenas após obter exportação estruturada autorizada e registrar filtros.",
  },
  {
    id: "datasebrae_tempo",
    name: "Tempo de Abertura",
    organization: "DataSebrae",
    url: "https://datasebrae.com.br/tempo-de-abertura-de-empresa/",
    description: "Indicadores de tempo da viabilidade e do registro empresarial.",
    purpose: "Acompanhar o ambiente de negócios, com distinção das etapas de abertura.",
    approach: "Consulta externa. Os valores só entram após exportação verificável e controle de unidades e metodologia.",
  },
  {
    id: "rs_em_dados",
    name: "RS em Dados",
    organization: "Invest RS / Governo do RS",
    url: "https://rsemdados.com.br/",
    description: "Painéis de economia, empresas, força de trabalho e comércio exterior.",
    purpose: "Contextualizar Canoas na economia estadual e apoiar atração de investimentos.",
    approach: "Consulta à plataforma; importar apenas tabelas com permissão, identificador territorial e proveniência.",
  },
  {
    id: "mapa_empresas",
    name: "Mapa de Empresas",
    organization: "Governo Federal / REDESIM",
    url: "https://www.gov.br/empresas-e-negocios/pt-br/mapa-de-empresas/painel-mapa-de-empresas",
    description: "Aberturas, baixas, estoque e tempo médio de abertura com extração documentada.",
    purpose: "Fonte oficial de verificação dos resultados locais e dos indicadores de simplificação.",
    approach: "Exportar conforme manual oficial, aplicar filtro Canoas e registrar os filtros e a extração.",
  },
  {
    id: "dados_rs",
    name: "Dados RS",
    organization: "Governo do RS / JUCISRS / DEE",
    url: "https://dados.rs.gov.br/",
    description: "Conjuntos abertos CSV, incluindo estatísticas da JUCISRS e indicadores econômicos do DEE.",
    purpose: "Agregar séries estaduais e municipais com licenças e metodologias explícitas.",
    approach: "Preferir CSV/licença do conjunto de dados e API CKAN quando aplicável.",
  },
];

export const INDICATOR_LABELS: Record<IndicatorId, string> = {
  aberturas: "Aberturas",
  baixas: "Baixas",
  ativas: "Empresas/estabelecimentos ativos",
  tempo_abertura_horas: "Tempo total de abertura",
  tempo_viabilidade_horas: "Tempo de viabilidade",
  tempo_registro_horas: "Tempo de registro",
  pib_brl: "Produto Interno Bruto",
  empregos_formais: "Vínculos formais",
  exportacoes_usd: "Exportações",
};

export function formatIndicator(value: number, unit: ExternalIndicatorRecord["unidade"]) {
  if (unit === "BRL") return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
  if (unit === "USD") return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: unit === "horas" ? 2 : 0 }).format(value) + (unit === "horas" ? " h" : "");
}

export function territoryName(code: Territory) {
  return code === "4304606" ? "Canoas" : "Rio Grande do Sul";
}
