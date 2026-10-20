# Cartografia econômica bivariada — Canoas

## Objetivo e navegação

A rota `/territorio/` complementa, sem substituir, os mapas de bairros, hexágonos e calor. Um mapa vetorial PMTiles dos 18 bairros oficiais GeoCanoas disponibiliza quatro modos:

1. **Concentração combinada (3 × 3):** tercis de densidade dos CNPJs ativos por bairro declarado (Receita Federal, competência indicada em tela) × tercis da densidade de endereços não residenciais CNEFE 2022 observados dentro do bairro.
2. **CNPJs por km²:** contagem ativa por bairro **declarado** / área do polígono oficial.
3. **Endereços CNEFE por km²:** endereços não residenciais com coordenadas fornecidas pelo IBGE e classificados espacialmente no bairro / área do polígono.
4. **Precisão CNEFE:** endereços não residenciais CNEFE em níveis de qualidade 1 e 2 / todos os endereços não residenciais CNEFE com coordenada atribuído ao bairro × 100.

A visualização permite selecionar um bairro, comparar os valores no popup e ranking, ocultar o mapa-base, destacar a geometria e exportar CSV com os indicadores independentes.

## Matriz bivariada

- Os dois eixos são padronizados **independentemente por tercis de bairros** (faixas de aproximadamente 1/3 da amostra de 18, não intervalos físicos absolutos).
- Eixo horizontal (colunas): densidade de CNPJs declarados da Receita; baixo → alto.
- Eixo vertical (linhas): densidade de endereços CNEFE 2022; baixo → alto.
- O algoritmo coloca observações iguais no mesmo tercil; classes podem ter contagens diferentes de seis.
- Valor não disponível ou suprimido fica cinza. Não se interpreta ausente como zero.
- A tonalidade expressa duas **posições relativas** na distribuição municipal: não indica correlação causal, uma localização individual de CNPJ ou índice numérico único.

## Regras de integridade

- Não extrapolar CNPJ 2026 para coordenadas CNEFE 2022. Os dois indicadores têm cobertura, propósito e referência temporal diferentes.
- Atribuição do CNPJ é pelo **nome declarado** do bairro (com aliases auditados); não por interseção de pontos.
- Endereços CNEFE foram classificados pelo ponto original em EPSG:31982 dentro dos polígonos oficiais. A qualidade da posição pode incluir coordenadas estimadas; 1/2 são os níveis de referência mais alta no conjunto.
- Todos os indicadores de densidade dividem-se pela **área total do bairro oficial**, mesmo quando inclui áreas sem ocupação. NÃO equivalem a densidade em área urbanizada ou taxa por residente.
- Contagens CNEFE positivas 1–4 são suprimidas nos dados públicos; valores públicos 0 indicam zero observado. Uma taxa com denominador zero ou com elemento suprimido é N/D.
- Há geometrias oficiais sobrepostas. As parcelas sem atribuição única permanecem documentadas, nunca rateadas arbitrariamente.
- Os 18 bairros e a tolerância de área de 0,2% são validados por testes automatizados.
- CSV contém somente agregados por bairro e suas classes relativas; não contém coordenadas individuais, endereços nem inscrições de empresas.

## Artefatos

Fontes **já versionadas**: `public/data/bairros-economia.json`, `bairros-economia.pmtiles`, `cnefe-hex500.json`, `bairros-rotulos.geojson`.
A página não inventa nova série temporal: lê as referências verificadas do último snapshot publicado de cada universo. A edição CNPJ é mensal; a CNEFE é censitária 2022.

Código: `src/lib/territorial-comparison.ts` (classificação) e `src/components/territorial-intelligence-dashboard.tsx` (visualização).
Teste: `tests/test_territorial_comparison.py`; fluxo browser `.github/workflows/geo-visual-check.yml`.

A próxima fonte potencial é um cruzamento reprodutível de setores censitários de 2022 e os limites oficiais de Canoas para acrescentar denominadores socioeconômicos espaciais; isso depende da validação e armazenamento das respectivas geometrias.
