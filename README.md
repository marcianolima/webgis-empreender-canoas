# Canoas Empreende

**WebGIS e Observatório Econômico de Canoas/RS — dados exclusivamente oficiais.**

**Site:** https://marcianolima.github.io/webgis-empreender-canoas/

**Workflow:** https://github.com/marcianolima/webgis-empreender-canoas/actions/workflows/deploy.yml

> Não existem dados fictícios, marcadores simulados ou estatísticas inventadas. Indicadores ausentes aparecem como indisponíveis. Valores estaduais são sempre identificados como RS.

## Fontes e funcionalidades

| Dado | Território | Fonte |
| --- | --- | --- |
| Empresas e outras organizações (até 2021), seções CNAE 2021 | Canoas | [IBGE CEMPRE, SIDRA 993](https://sidra.ibge.gov.br/tabela/993) |
| PIB municipal a preços correntes (mil reais na origem) | Canoas | [IBGE, SIDRA 5938](https://sidra.ibge.gov.br/tabela/5938) |
| População do Censo 2022 | Canoas | [IBGE, SIDRA 4714](https://sidra.ibge.gov.br/tabela/4714) |
| Limite municipal (GeoJSON) | Canoas | [IBGE, API de Malhas](https://servicodados.ibge.gov.br/api/v3/malhas/municipios/4304606?formato=application/vnd.geo%2Bjson&qualidade=minima) |
| Constituições/extinções e filiais | Estado RS (não Canoas) | [Dados RS / JUCISRS](https://dados.rs.gov.br/dataset/empresas-constituidas) — CC0-1.0 |
| Fundo cartográfico | Canoas | [OpenStreetMap](https://www.openstreetmap.org/copyright) |

O painel inclui indicadores com ano e fonte, séries IBGE e JUCISRS, filtros de seção CNAE e série estadual, mapa com contorno real de Canoas, exportação CSV, catálogo de fontes e metodologia.

**Comparabilidade:** CEMPRE é um universo estatístico de empresas e organizações; não corresponde a todos os estabelecimentos CNPJ ativos. A série municipal utilizada termina em 2021. Dados de abertura/baixa JUCISRS disponíveis são agregados estaduais. Nenhuma taxa de geocodificação é calculada sem pontos reais. Não são exibidas aberturas/baixas CNPJ municipais sem extração real.

## Arquitetura somente com GitHub

- **GitHub Actions** executa scripts/collect_official.py para coletar IBGE SIDRA, malha IBGE e CSVs JUCISRS (sem chave de API), com testes Python, lint e TypeScript.
- **Next.js 15, TypeScript, Tailwind, MapLibre e Recharts** exportam site estático para out/ com basePath correto.
- **GitHub Pages** publica o artefato da workflow, sem Vercel, backend persistente ou serviço pago.
- **Atualização:** em pushes para main, manualmente por workflow_dispatch e toda segunda-feira às 10:27 UTC (agendamentos podem atrasar).

## Configuração GitHub Pages

Em Settings → Pages → Build and deployment → Source, selecione **GitHub Actions** caso ainda não esteja habilitado. Consulte a execução em Actions e confirme a URL pública após o deploy.

## Execução local

Requisitos: Node 22+ e Python 3.12+.

1. Clone o repositório.
2. Execute: python -m unittest discover -s tests -v
3. Execute: python scripts/collect_official.py
4. Execute: npm install
5. Execute: npm run dev

Abra http://localhost:3000. A compilação estática é executada com npm run build. Os arquivos reais gerados aparecem em public/data/ e no artefato do GitHub Pages; o arquivo base do Git pode conter apenas o esquema vazio até a coleta.

## Próximas entregas (dados reais somente)

1. Ingestão mensal completa da Receita Federal CNPJ em job independente, preservando competência, todos fragmentos, validação de registros e LGPD.
2. Aberturas, baixas, MEI, Simples e CNAE atuais de Canoas, após extração e reconciliação com Mapa de Empresas.
3. Geocodificação confiável de estabelecimentos e integração de bairros GeoCanoas; publicar pontos apenas após QA, revisão de direitos e privacidade.
4. DataSebrae e RS em Dados por API ou exportação documentada, com fonte e território explícitos.
5. Testes de acessibilidade WCAG 2.1 AA e homologação em dispositivos reais.

Código sob [MIT](LICENSE). As bases públicas e os tiles externos mantêm condições próprias. Consulte [docs](docs/) e [Metodologia](src/app/sobre/page.tsx).

## Atualizações setoriais, REDESIM e CNPJ

- **CNPJ oficial**: [pipeline completo](.github/workflows/cnpj.yml) processa dez partes de Estabelecimentos, dez de Empresas, Simples/MEI e CNAE diretamente do WebDAV da Receita, por competência. A publicação é atômica e só ocorre após todos os arquivos e controles de integridade serem concluídos. [Painel de estabelecimentos](src/app/cnpj/page.tsx). Quando não houver snapshot validado, os dados permanecem indisponíveis.
- **Setores municipais IBGE**: [coletor](scripts/collect_sectors.py) e [painel](src/app/setores/page.tsx) para PAM (agricultura), PPM (pecuária), PEVS (extração vegetal) e VAB da agropecuária, com área, quantidade, valor, ano e unidade conforme cada fonte.
- **REDESIM e JucisRS**: documentação e acesso oficial na página [Fontes](src/app/fontes/page.tsx). Tempo de abertura tem dados processuais REDESIM, não pode ser inferido das datas do CNPJ. A fonte Mapa de Empresas documenta alteração metodológica a partir de dezembro/2025.
- **DEE/BI Setorial, DataRS, RS em Dados, DataSebrae, Sebrae, InvestCanoas**: catálogo atualizado com links para os painéis temáticos; números só entram na base própria quando a exportação está licenciada e conferida.

A rotina volumosa da Receita é separada do deploy estático e roda mensalmente no GitHub Actions. A fotografia anterior continua disponível se qualquer fragmento falhar; nunca apresentar 1 ou 9 partes como se fossem 10.

### DEE/DataRS: indicadores municipais já integrados ao código

A rota `/trabalho` utiliza o coletor `scripts/collect_dee.py` e os arquivos CSV oficiais [Exportações — Total](https://data.rs.gov.br/download/dee-4949.csv) e [Emprego — Número de Vínculos Empregatícios](https://data.rs.gov.br/download/dee-5483.csv). O filtro usa exatamente o código IBGE **4304606** e exige cobertura municipal no conjunto antes de disponibilizar valores. A unidade de exportação é US$ FOB; a unidade do emprego são vínculos formais (não pessoas únicas). Sem inferência de anos indisponíveis.

### REDESIM e Mapa de Empresas

A rota `/redesim` é exclusiva para séries de tempo de abertura, viabilidade, registro e formalização, com proveniência. A entrada é o CSV agregado validado por `scripts/import_external_indicators.py`, com `fonte=mapa_empresas` ou `fonte=redesim_jucisrs` e `territorio=4304606`. Como não foi confirmada uma API de extração pública livre de autenticação para os indicadores municipais processuais, nenhum prazo é gerado ou estimado. Ver [orientações oficiais](https://www.gov.br/empresas-e-negocios/pt-br/mapa-de-empresas/painel-mapa-de-empresas) e [JucisRS](https://www.redesim.rs.gov.br/). Há quebra de metodologia de tempos a partir de dezembro/2025.

## Política de atualidade e continuidade histórica (2026-10)

- **Última competência oficial** por série: SIDRA usa o ano final de seus metadados; fontes mensais MDIC, MTE e Receita dependem da publicação/carga oficial confirmada.
- **CEMPRE**: tabela 993 (2006–2021) e tabela 9582 (2022–2024) são séries independentes; quebra em 2022 — não calcular variação cruzando a quebra.
- **PIB**: tabela 5938 (desde 2002), último ano oficial 2023. Os resultados de 2022–2023 exigem nota do IBGE sobre procedimentos especiais e revisão futura da base 2010 para 2021 em 2027. Valores nominais não equivalem a crescimento real.
- **População**: Censo 2022 preservado; estimativa anual 2026 por tabela IBGE 6579. Não misturar estimativa e recenseamento em taxas como se fossem mesmo levantamento.
- **Novas fontes prioritárias**: MDIC/Comex Stat 2026-09, MTE/Novo Caged 2026-08, IDESE Revisão 2026 (dados 2022–2024), BNDES desembolsos por município, BCB/ESTBAN.
- **Garantia:** toda atualização deve preservar o histórico anterior e registrar ano/período de referência, fonte, unidade e ressalvas de série, sem imputar zeros.

## Observatório Sebrae — Panorama socioeconômico de Canoas (outubro de 2026)

O novo painel `/sebrae` integra **somente dados agregados do perfil público do Sebrae**, sem reproduzir suas imagens/gráficos/código. O coletor `scripts/collect_sebrae.py` lê o bloco `__NEXT_DATA__` servido publicamente pelo perfil https://observatorio.sebrae.com.br/profile/geo/canoas, confirma o código IBGE 4304606, seleciona indicadores numéricos e publica `public/data/sebrae.json`.

O painel apresenta nove eixos: empresas/MEI/CNAE; emprego e salário RAIS; ocupações; finanças públicas/PIB; educação e formação; mercado consumidor; inclusão/IDHM; agropecuária; comércio exterior. Os históricos RAIS 2024–2025 provêm da série estruturada pública. Há ainda uma fotografia auditada do conteúdo narrativo em `src/data/sebrae-archive-2026-10.json` (18/10/2026), preservando as unidades, os anos, o universo e o aviso de que não constitui atualização automática.

A rotina `.github/workflows/sebrae.yml` executa coleta mensal e manual, valida o território, ano e consistência, salva um artefato recuperável e realiza commit seguro do agregado. O push aciona a publicação no GitHub Pages, sem dependência de Vercel.

**Atenção metodológica:** Sebrae e Receita Federal direta possuem diferentes fotografias (Sebrae: 60.100 ativos; carga RFB de outubro/2026: 60.243), não somar nem inferir 143 aberturas/baixas; RAIS e CAGED não medem o mesmo universo; valores SICONFI per capita e ENEM requerem conferência específica; o zero publicado no gráfico de Comex 2026 não é interpretado como ausência de exportação. A série municipal principal IBGE/PIB 2002–2023 mantém as ressalvas oficiais.

O material do Sebrae funciona como índice de descoberta e comparação. Para produzir novas séries históricas completas por indicador, a prioridade permanece obter o conjunto público da **fonte primária**, não reconstruir visualizações fechadas de terceiros.

### Resiliência das séries históricas estaduais

A coleta semanal preserva o histórico público JUCISRS/DataRS já conferido: se a API estadual estiver indisponível (timeout ou erro HTTP), os registros anteriores são mantidos, a indisponibilidade é registrada em `quality.errors` e não é interpretada como zero. Em 18/10/2026 os 110 registros históricos foram recuperados de artefato GitHub Pages verificado e persistidos em `public/data/official.json`; a recuperação foi auditada pelo workflow `recover-rs-history.yml`. Os dados mensais estaduais permanecem separados dos indicadores municipais de Canoas.

## Séries interativas originais do Observatório Sebrae — Etapa 8

O explorador `/sebrae/series` apresenta reproduções **próprias** dos dados públicos dos cubos OLAP do Observatório Setorial Territorial, com filtro estrito por Canoas (IBGE 4304606). O catálogo completo dos metadados contém **87 cubos**; `scripts/sebrae_series_specs.json` define as consultas multidimensionais efetivamente coletadas (mais de 70 séries distintas). A rotina mensal `.github/workflows/sebrae-series.yml` executa as consultas anônimas verificáveis via `https://apiv2-observatorio.sebrae.com.br/tesseract/data.jsonrecords` e persiste `public/data/sebrae-series.json`.

Reprodução significa **série temporal e seus recortes públicos em gráficos próprios**, não copiar os gráficos, o JavaScript ou elementos protegidos do site Sebrae. Os dados são armazenados no GitHub, para que o site GitHub Pages não dependa de CORS nem de serviço no navegador. Fontes primárias e ressalvas são preservadas, e exportação CSV é oferecida por seleção.

**Controle essencial RAIS:** aplicar `Active worker indicator=1`; os 95.355 vínculos RAIS 2025 ficam reconciliados com o perfil de Canoas. A consulta sem filtro devolve 155.787, englobando vínculos não ativos e inflando o indicador. Os demais cubos exigem tratamento específico (médias, impostos, saldo CAGED, PIB, níveis contábeis, condições de ano parcial etc.).

O explorador registra cubos sem dados municipais, filtros não suportados e fontes indisponíveis, sem inventar valores. Registros com contagem entre 1 e 4 são suprimidos; resultados anteriores conferidos são preservados se a API falhar.
