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
