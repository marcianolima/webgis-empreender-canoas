# Receita Federal: coleta mensal integral no GitHub

## Fonte verificada

**Fonte primária:** serviço público WebDAV da própria Receita Federal/SERPRO+.

- Compartilhamento oficial: https://arquivos.receitafederal.gov.br/index.php/s/YggdBLfdninEJX9
- WebDAV público (via token do compartilhamento): caminho \`public.php/dav/files/{token}/{competencia}/\`; verifique o estado de acesso antes de cada coleta
- Metadados oficiais do leiaute: https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf

A competência é **selecionada dinamicamente** como a pasta mensal mais recente que contenha todos os **dez Estabelecimentos**, **dez Empresas**, **Simples**, **Municipios** e **Cnaes**. Não misturar cargas de meses diferentes.

## Jobs separados

1. \`discover\`: lista a pasta oficial pelo método WebDAV PROPFIND e exige todos os arquivos.
2. \`establishments\`: dez jobs do GitHub Actions (máximo dois simultâneos), cada um baixa o próprio ZIP completo, valida ZIP e filtra Canoas pelo código municipal da tabela *Municipios* da Receita.
3. \`assemble\`: exige dez manifests distintos da mesma competência, cruza as dez partes de Empresas por CNPJ básico, carrega Simples/MEI, interpreta CNAE e agrega.
4. Antes da publicação: verifica 10/10 + 10/10, integridade da soma de registros por parte, chaves únicas e contagem de ativos, metadados, anos e supressão de células pequenas.
5. Publica **somente** \`public/data/cnpj.json\` com fotografia nacional integral filtrada para Canoas e metadados; o commit automatizado dispara o workflow de GitHub Pages via \`workflow_dispatch\`. Arquivos ZIP e CNPJs individuais **não** entram no GitHub público.

Execução: **Actions → CNPJ Receita Federal | Carga integral e atualização → Run workflow**, ou agendamento mensal dia 12 às 08h37 UTC. Runner necessita disponibilidade da fonte e banda suficientes; não garante sucesso diante de interrupções externas.

## Significado dos números

- Estabelecimento: CNPJ completo; não confundir com empresa-raiz (matrizes + filiais contam).
- Ativo: situação 02 na fotografia.
- Abertura: data de início da atividade, **inclusive** registros hoje baixados.
- Baixas do período: apenas cadastros cuja **última** situação é 08 e cuja data de situação pertence ao período. **Não** corresponde a todos eventos de baixa históricos.
- Saldo: aberturas menos baixas assim definidas; pode diferir da variação de estoque real entre fotografias mensais.
- Porte: informado em Empresas, herdado pelo estabelecimento.
- Simples/MEI: arquivo oficial Simples; desconhecidos não entram no denominador de opção.
- Bairro: informado à Receita, não validado espacialmente nem necessariamente igual ao bairro oficial GeoCanoas.

Sem coordenadas de estabelecimentos ou precisão espacial inventada. Publicações individualizadas exigem avaliação legal e LGPD. Para distribuição setor × bairro, células com menos de cinco estabelecimentos não são publicadas.

## Falha e recuperação

Qualquer arquivo ausente, ZIP inválido, registro duplicado, parte incompleta, falha de download ou divergência de cobertura deve **falhar sem sobrescrever** a fotografia anterior. Consultar logs/artefatos do GitHub Actions. Se o fornecedor alterar o compartilhamento, atualizar o endpoint somente após verificar a origem oficial.

O processamento é oneroso em banda/CPU; manter separação em relação ao deploy semanal leve. A rotina mensal pode demorar conforme a capacidade do GitHub runner e do repositório oficial.

## Status de publicação

Verificar https://marcianolima.github.io/webgis-empreender-canoas/cnpj/ — a página usa \`status=not_loaded\` enquanto não houver uma execução completa aprovada. **A presença do pipeline não implica dados importados.**
