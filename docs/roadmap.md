# Roadmap e critérios de aceite

## 0.1 — Fundação (etapa atual)
- [x] README, licença, organização e regras de privacidade.
- [x] Base Next.js, TypeScript, Tailwind, Zustand, Recharts, MapLibre e configuração shadcn.
- [x] Ingestor local inicial e documentação.
- [x] Interface demonstrativa, explicitamente não oficial.
- [ ] Testar \`npm install\`, \`npm run build\` e \`npm run typecheck\` em CI.

## 0.2 — Base municipal
- [ ] Ingerir lote real completo (todos os ZIPs) e tabelas auxiliares com checksums.
- [ ] Documentar competência, recortes, total de registros, faltantes e duplicidades.
- [ ] Estabelecer testes de dados, auditoria e reconciliação de indicadores.

## 0.3 — Território
- [ ] Importar polígonos oficiais, versão das geometrias, referência espacial.
- [ ] Geocodificar com método/confiança por ponto, coberturas e amostra manual auditada.
- [ ] Publicar clusters e calor **somente dos pontos válidos**, mantendo cobertura visível.
- [ ] Filtros CNAE em três níveis, MEI/Simples, situação, porte e bairro.

## 0.9 — Homologação
- [ ] Série mensal reproduzível (snapshots e regras de eventos).
- [ ] Documentar métricas e correspondência/diferenças com Mapa de Empresas.
- [ ] Testes responsivos em aparelhos reais, WCAG 2.1 AA e auditoria de segurança/LGPD.
- [ ] Avaliar tempos de carregamento, custos e limites Vercel.

## 1.0 — Produção
- [ ] Indicadores municipais oficiais conferidos e assinados pela área responsável.
- [ ] Mapa + dashboard integrados, cobertura cartográfica e data de atualização exibidas.
- [ ] Catálogo de dados, política de privacidade e instruções de uso público.
- [ ] Deploy Vercel e plano de rollback.

## 1.1+
- Pipeline mensal automatizado e notificações em falhas.
- Exportação agregada CSV/GeoJSON, documentação de API e painéis setoriais.
- Camada contextual de demografia/emprego/renda e métricas de densidade por área.
- Histórico comparável e painel interno de auditoria e aprovação editorial.

## Complemento — DataSebrae e RS em Dados (etapa 2)

- [x] Catalogar painéis e distinguir acesso externo de ingestão estruturada.
- [x] Criar rota `/fontes` e esquema de indicadores agregados com metadados.
- [x] Criar importador Python com validação de URL, município, competência, unidade e duplicidade.
- [ ] Obter exportações oficiais com filtros Canoas e termos de uso confirmados.
- [ ] Ingerir séries verificadas das plataformas e reconciliar com CNPJ conforme universo.
- [ ] Validar atualizações em lote e acordos de acesso/API antes de automatizar.

## 2026-10 — Receita Federal, REDESIM e setores
- [x] Fonte oficial WebDAV da Receita identificada e verificada para 2026-10.
- [x] Pipeline GitHub Actions em dez fragmentos com junção Empresas + Simples e bloqueio de publicação parcial.
- [x] Páginas CNPJ e setores, sem registros sintéticos.
- [x] Catálogo ampliado de DEE/BI Setorial, DataRS, Sebrae, REDESIM e InvestCanoas.
- [ ] Marcar snapshot da Receita como carregado somente após sucesso real dos dez shards, junções e checksums.
- [ ] Importar dados municipais de tempo de abertura REDESIM mediante exportação oficial estruturada.
- [ ] Adicionar exportações e emprego municipal do DEE após validação do esquema do CSV.
- [ ] Homologar geocodificação e privacidade para pontos reais.

- [x] Criar importador DEE/DataRS com filtro IBGE Canoas, validação de 450+ municípios, valores anuais e unidades oficiais.
- [x] Adicionar página de trabalho e exportações e importação no deploy GitHub Pages.

- [x] PIB: último ano obtido via metadados oficiais da tabela SIDRA 5938, série histórica longa e nota pública de metodologia para 2022–2023; revisão esperada em 2027.
- [x] CEMPRE: integrar tabela atual 9582 (2022+) separada da histórica 993 (2006–2021); impedir interpretação da quebra de 2022 como crescimento.

- [x] Adicionada estimativa populacional IBGE/SIDRA 6579 até 2026 em série própria, sem substituir a série censitária 2022.
- [x] Ampliado histórico CEMPRE antiga série desde 2006, PIB desde 2002 e JUCISRS desde 2023 (conforme cobertura disponível).
- [ ] Integrar Comex Stat/MDIC mensal por município (até setembro/2026 verificado); manter série DEE 2010–2023 como histórico separado.
- [ ] Integrar Novo Caged do MTE (até agosto/2026 verificado); manter RAIS/DEE 2022–2023 como estoque de vínculos histórico.
- [ ] Integrar IDESE Revisão 2026 (série 2022–2024) para comparativos Canoas × RS × municípios.
- [ ] Integrar BNDES desembolsos municipais e Banco Central ESTBAN em abas financeiras.

### Etapa 7 — Perfil público Observatório Sebrae Canoas
- [x] Perfil público analisado por renderização real e dados estruturados do HTML do portal.
- [x] Fotografia de 61 indicadores narrativos agregados (outubro/2026), de múltiplos temas.
- [x] Coletor de métricas estruturadas com território IBGE 4304606 e histórico RAIS 2024–2025.
- [x] Página temática mobile-first, gráficos, busca, CSV e contexto metodológico.
- [x] Comparação documentada entre Sebrae e CNPJ RFB; sem soma indevida dos universos.
- [x] Coleta mensal própria no GitHub Actions e publicação no Pages após validação.
- [ ] Ampliar séries por emprego/ocupação, cursos, orçamento e mobilidade a partir das fontes primárias quando abertas.
- [ ] Homologar critérios de divergência RFB/Sebrae com o Sebrae e a Receita.

### Etapa 8 — Reconstituição dos históricos multidimensionais Sebrae
- [x] API Tesseract pública verificada sem autenticação; catálogo estruturado dos 87 cubos.
- [x] Reconciliação RAIS: indicador "ativo" exige filtro = 1, 2025 95.355 vínculos.
- [x] Coletor de dezenas de séries comparáveis por ano/mês, sexo, CNAE, porte, profissões, matriz, REDESIM, MDIC, SICONFI, INEP, PNUD e agro.
- [x] Série materializada no GitHub Pages com metadados, filtros, classificação territorial, CSV e histórico.
- [x] Explorador genérico adaptado a telas menores, com diferenciação entre dados extraídos e cubos somente catalogados.
- [ ] Resolver cubos sem limite municipal ou sem fatos para Canoas com fontes primárias e estudo metodológico.
- [ ] Validar interativamente cada combinação arbitrária disponível na interface Sebrae além das consultas já materializadas.

### Etapa 9 — Inteligência territorial em PMTiles
- [x] Validado FeatureServer BAIRROSOFICIAL: 18 polígonos, EPSG:31982 e POPULACAO_2022.
- [x] Criado ETL de bairros com geometrias oficiais EPSG:4326, aliases explícitos e controle de não conciliados.
- [x] PMTiles v3 vetorial real, com geração mensal no GitHub Actions, SHA256 e publicação estática.
- [x] Indicadores CNPJ por bairro, CNAE, densidade por km² e por população 2022 da camada GeoCanoas.
- [x] Arquivo temporal de snapshots por bairro e visualização histórica sem pontos inventados.
- [x] Página cartográfica mobile-first com MapLibre e exportação CSV.
- [ ] Incorporar endereços completos RFB no processamento reservado e testar geocodificação oficial (lotes/vias), medir classe de precisão e impacto LGPD.
- [ ] Produzir grades/hexágonos ou heatmaps somente após validação de coordenadas pontuais reais.
