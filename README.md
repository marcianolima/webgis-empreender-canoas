# Canoas Empreende
### Observatório de Desenvolvimento Econômico e Dinâmica Empresarial de Canoas/RS

[![Licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-2563eb.svg)](LICENSE)
![Situação](https://img.shields.io/badge/estado-funda%C3%A7%C3%A3o%20t%C3%A9cnica-amber.svg)
![Fonte principal](https://img.shields.io/badge/dados-Receita%20Federal%20%2F%20CNPJ-047857.svg)

Plataforma **WebGIS + dashboard**, aberta e orientada a evidências, para compreender **onde** estão os estabelecimentos, **quais** setores predominam e **como** evolui a atividade empresarial em Canoas, Rio Grande do Sul.

> [!IMPORTANT]
> **Estado do projeto — etapa 1:** estrutura técnica e protótipo de interface. A interface inicial utiliza **amostra sintética sinalizada como demonstração**. **Nenhum indicador demonstrativo representa estatística oficial de Canoas.** Os dados municipais definitivos serão publicados apenas após ingestão, conferência e geocodificação da base real.

## Visão do produto

- **Observatório**: estabelecimentos ativos, aberturas, baixas, saldo, porte, CNAE, MEI e Simples.
- **Mapa de empresas**: pontos de estabelecimentos geocodificados, clusters, calor, bairros e recortes territoriais, sempre explicitando a precisão de localização.
- **Filtros únicos**: o mesmo recorte deve repercutir no mapa, indicadores e gráficos.
- **Transparência**: datas de referência, definição das métricas, rastreabilidade, cobertura e limitações.
- **Fontes complementares**: DataSebrae, RS em Dados, Mapa de Empresas e Dados RS, com importação opcional de indicadores agregados auditados.
- **Uso público**: desenho responsivo e acessível, pensado para gestores, empreendedores e pesquisadores.

### O que está implementado nesta etapa

| Entrega | Situação |
| --- | --- |
| Repositório público, licença MIT, organização de pastas | Estruturado |
| Documentação de fontes, métricas, geocodificação, atualização e limitações | Inicial |
| Next.js (App Router), TypeScript, Tailwind, Zustand, Recharts e MapLibre | Base criada |
| Dashboard + mapa com amostra sintética, filtros integrados | Protótipo, não homologado |
| Ingestão local de arquivos da Receita (ZIP/CSV) com filtro para Canoas | Script inicial |
| Catálogo de painéis públicos + importador de indicadores agregados | Base criada; sem valores importados |
| Série mensal oficial auditada e cruzamento espacial validado | Pendente |
| Atualização mensal automática e implantação Vercel | Pendente |

## Público

Secretaria Municipal de Desenvolvimento Econômico e Inovação (SMDEI), demais órgãos municipais, empreendedores, investidores, pesquisadores e população. Projeto independente, **sem declaração de endosso oficial** até eventual homologação institucional.

## Fontes e prioridade

| Fonte | Uso previsto | Status de integração |
| --- | --- | --- |
| [Receita Federal — CNPJ](https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-da-pessoa-juridica---cnpj) | Estabelecimentos, empresas, CNAE, situação, porte, Simples/MEI | Ingestor local inicial; sem base baixada |
| [Leiaute da Receita](https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf) | Tipagem e interpretação de campos | Documentado |
| [IBGE — malhas de setores e bairros](https://www.ibge.gov.br/geociencias/organizacao-do-territorio/estrutura-territorial/26565-malhas-de-setores-censitarios-divisoes-intramunicipais.html) | Limites e contexto censitário | Planejado |
| [GeoCanoas](https://geo.canoas.rs.gov.br/portal/) | Limites municipais/bairros e referências territoriais | A avaliar serviços e permissões |
| [Prefeitura de Canoas](https://www.canoas.rs.gov.br/) | Dados locais disponíveis e validação institucional | A avaliar |
| [OpenStreetMap](https://www.openstreetmap.org/) | Referência de ruas e enriquecimento cartográfico | Mapa-base e geocodificação a homologar |
| [Mapa de Empresas — Governo Federal](https://www.gov.br/empresas-e-negocios/pt-br/mapa-de-empresas) | Confronto de indicadores agregados | Planejado |

### Fontes complementares e painel de referência

A rota **`/fontes`** cataloga DataSebrae (abertura e tempo), RS em Dados, Mapa de Empresas e Dados RS/JUCISRS. Dados agregados, se exportados legalmente e revisados, podem ser convertidos em série no projeto com `scripts/import_external_indicators.py`. **Atualmente nenhuma série externa foi importada.** Relatórios Power BI consultáveis não implicam API pública de extração.

Consulte [docs/fontes.md](docs/fontes.md) e [docs/fontes-complementares.md](docs/fontes-complementares.md) antes de utilizar um dado como indicador oficial.

## Arquitetura proposta

\`\`\`text
Arquivos públicos mensais da Receita Federal (ZIP, CSV)
      │
      ▼
scripts/ingest_cnpj.py  ──► data/processed/*.csv (fora do Git)
      │                            │
      │                    QA + geocodificação
      ▼                            ▼
data snapshots / indicadores     GeoJSON / Parquet validados
      │                            │
      └────────► publicação de artefatos leves ◄─────────┘
                              │
                 Next.js / TypeScript (Vercel)
                 ├─ App Router
                 ├─ Zustand (filtros)
                 ├─ Recharts (visualizações)
                 └─ MapLibre (cartografia)
\`\`\`

**Decisão de escalabilidade:** processar os grandes arquivos CNPJ **fora** do build/deploy Vercel; o site recebe somente recortes ou agregados derivados, versionados e auditados. Não enviar os ZIPs nacionais à Vercel ou ao repositório.

## Como executar a interface

**Pré-requisitos:** Node.js 20+ e npm; Python 3.11+ para ingestão.

\`\`\`bash
git clone https://github.com/marcianolima/webgis-empreender-canoas.git
cd webgis-empreender-canoas
npm install
npm run dev
\`\`\`

Abra http://localhost:3000. Na etapa 1, a interface exibe apenas **dados de demonstração** identificados. Os registros fictícios não possuem CNPJ de empresas reais.

Comandos: \`npm run dev\`, \`npm run build\`, \`npm run lint\`, \`npm run typecheck\`.

## Ingestão local inicial (base CNPJ)

1. Acesse o catálogo oficial da Receita e baixe **todos** os ZIPs \`Estabelecimentos\` e \`Empresas\` do **mesmo mês de referência**; opcionalmente \`Simples\`; e a tabela \`Municipios\`.
2. Salve os arquivos fora do repositório público, por exemplo \`data/raw/2026-09/\`. Confira nomes e leiaute conforme documentação da Receita.
3. Execute (substitua \`ANO-MES\` e nomes conforme os arquivos baixados):

\`\`\`bash
python scripts/ingest_cnpj.py \
  --estabelecimentos data/raw/ANO-MES/Estabelecimentos*.zip \
  --empresas data/raw/ANO-MES/Empresas*.zip \
  --municipios data/raw/ANO-MES/Municipios.zip \
  --simples data/raw/ANO-MES/Simples.zip \
  --referencia ANO-MES
\`\`\`

**Importante:** os padrões \`*.zip\` são expandidos pelo shell em Linux/macOS. No PowerShell, forneça caminhos individuais ou uma lista explícita. O ingestor aceita múltiplos arquivos nos argumentos \`--estabelecimentos\` e \`--empresas\`. Alternativamente, forneça \`--codigo-municipio\` após conferir o código na tabela da própria Receita.

A saída inicial é \`data/processed/estabelecimentos_canoas.csv\` e \`data/processed/metadata.json\`, **sem coordenadas**. O script não consulta geocodificador nem publica endereços automaticamente. Ver [docs/atualizacao-mensal.md](docs/atualizacao-mensal.md) e [docs/geocodificacao.md](docs/geocodificacao.md).

## Interpretação correta dos indicadores

**Unidade de análise:** estabelecimento CNPJ completo (14 posições no layout tradicional), não raiz de empresa. Matriz e filial contam separadamente.

- **Ativos:** situação cadastral 02 na fotografia do mês.
- **Aberturas:** data de início da atividade cadastral na janela selecionada; não implica que o estabelecimento continue ativo.
- **Baixas:** situação 08 com data da situação cadastral no período, **conforme último estado visível na fotografia**.
- **Saldo:** aberturas menos baixas **segundo essas regras**; não equivale necessariamente à variação entre dois estoques.
- **MEI:** optante MEI no arquivo Simples correspondente, **não** inferido apenas do porte.
- **Localização:** endereço cadastral não é prova de operação no local ou de existência física.

As fotografias mensais do CNPJ **não são um log completo de eventos históricos**. Para análises longitudinais robustas de situação e movimentação, o projeto deverá armazenar snapshots mensais, versionar regras de reconciliação e confrontar agregados do Mapa de Empresas. Nunca misturar valores de recortes ou datas distintas sem indicação.

## Qualidade, acessibilidade e privacidade

A publicação oficial exige data de referência, versão do pipeline, registros elegíveis, duplicidades, consistência temporal, taxa de geocodificação e distribuição de métodos/precisão. Ponto aproximado (rua, CEP, bairro) não será apresentado como número exato. CNPJ e razão social podem ser públicos, mas disponibilização de dados individualizados passará por análise de LGPD, risco de exposição de empresários individuais e termos/licenças das fontes. Dados de sócios/CPF não integram o escopo público.

Design mobile-first, navegação por teclado, foco visível, contraste e textos alternativos são requisitos permanentes. A conformidade WCAG 2.1 AA **ainda precisa de auditoria**.

## Estrutura

\`\`\`text
src/
  app/                 rotas, layout e estilos globais
  components/          dashboard, mapa e filtros
  data/                amostra sintética de demonstração
  lib/                 agregações e utilitários
  store/               estado compartilhado (Zustand)
  types/               contratos TypeScript
scripts/               ingestão CNPJ e importação de indicadores agregados
docs/                  metodologia e governança de dados
data/raw/              ZIPs originais (ignorado pelo Git)
data/processed/        dados derivados (ignorado pelo Git)
public/                recursos estáticos leves
\`\`\`

## Roadmap

**Etapa 1 — Fundação:** configuração, documentação, interface demonstrativa e ingestor local.

**Etapa 2 — Dados reais:** baixar lote CNPJ completo, resolver CNAE/natureza jurídica, testar consistência, construir séries por snapshots e reconciliação com Mapa de Empresas.

**Etapa 3 — Inteligência territorial:** integrar bairros oficiais, pipeline de endereços e geocodificação por níveis de confiança, agregar pontos com controle de exposição.

**Etapa 4 — Observatório 1.0 homologado:** indicadores auditados, filtros hierárquicos, mapa de clusters/calor, exportações, testes WCAG, testes móveis e publicação Vercel.

**Etapa 5 — Evolução:** atualizações automatizadas, painéis por setor e bairro, demografia e renda, API pública, metadados e painel de monitoramento operacional.

Veja [docs/roadmap.md](docs/roadmap.md) para critérios de aceite e dependências.

## Contribuições e licença

Contribuições por issues e pull requests são bem-vindas. Não suba base nacional completa nem informações pessoais desnecessárias. Código sob [MIT](LICENSE); **bases de terceiros têm licenças e condições próprias**. Mapas e dados devem trazer atribuição compatível com cada origem.

**Aviso:** informação estatística para análise territorial, não certidão de regularidade, autorização comercial, comprovação de endereço nem consulta oficial ao CNPJ.
