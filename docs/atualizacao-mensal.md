# Atualização mensal do CNPJ

## Sequência operacional

1. Verificar **lote mensal disponível** no catálogo oficial da RFB, preservando data de referência e URLs.
2. Baixar **todos** os fragmentos de Empresas e Estabelecimentos, opcionalmente Simples e tabelas auxiliares; **não misturar meses**.
3. Gravar manifest \`sha256\`, tamanho, fonte, data de coleta e mês.
4. Processar em disco local/runner adequado; arquivos nacionais são grandes demais para o runtime serverless da Vercel.
5. Rodar ingestor inicial e conferir métricas brutas; é obrigatório ter todos os fragmentos de Estabelecimentos, ou as contagens ficarão incompletas.
6. Executar validações: CNPJ, códigos, datas, inclusão de matriz e filiais, duplicidade, referências faltantes.
7. Produzir recorte tabular, geocodificação validada, resumos mensais e agregados por bairro/CNAE.
8. Comparar com mês anterior (novas inscrições, alteração de situação, alteração de endereço) e com agregado Mapa de Empresas.
9. Revisar uso de dados pessoais e publicar **artefatos leves**, atribuição e metadados na interface.
10. Homologar em staging antes da produção; reter snapshots/manifest anteriores para auditoria.

## Ingestão inicial no computador local

Python 3.11+, somente biblioteca padrão; não requer banco externo. Os arquivos ZIP podem ser acessados em streaming.

\`\`\`bash
python scripts/ingest_cnpj.py \
  --estabelecimentos data/raw/ANO-MES/Estabelecimentos*.zip \
  --empresas data/raw/ANO-MES/Empresas*.zip \
  --municipios data/raw/ANO-MES/Municipios.zip \
  --simples data/raw/ANO-MES/Simples.zip \
  --referencia ANO-MES
\`\`\`

Alternativa: \`--codigo-municipio CODIGO_RFB\` se a tabela de municípios não estiver presente. **Não usar o código IBGE 4304606 como código municipal RFB**.

Saída: \`data/processed/estabelecimentos_canoas.csv\` e \`data/processed/metadata.json\`. Não realizar commit desses dados.

## Diferenças entre estoques e eventos

Um retrato cadastral não recupera todos os eventos passados. \`data_inicio_atividade\` serve para contagem de aberturas cadastrais; baixas pela \`data_situacao_cadastral\` da última situação e \`situacao=08\` não necessariamente preservam todo o histórico de alterações. A versão 1.0 deverá manter snapshots mensais e documentar revisão de séries.

## Automação futura

Pipeline mensal agendado após publicação do lote RFB, com idempotência (\`referencia + checksums\`), retry, logs, alertas, limites de download, controle de qualidade bloqueante, aprovação para publicar, rollback e artefatos imutáveis. Primeiro mês só será marcado como publicado após homologação.

**Atualização automática ainda não está ativa.**
