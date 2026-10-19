# Topologia hexágono × bairro oficial — Canoas

**Sistema métrico:** SIRGAS 2000 / UTM zona 22S, EPSG:31982. **Visualização:** PMTiles v3, EPSG:4326.
**Fontes:** GeoCanoas BAIRROSOFICIAL e IBGE CNEFE Censo 2022; subconjunto RFB-CNEFE conciliado por endereço quando disponível.

## Objetivo e metodologia

1. Projetar os 18 polígonos oficiais e a grade hexagonal, com distância de 500 m entre faces, no sistema métrico EPSG:31982.
2. Intersectar cada célula com os polígonos oficiais e conferir conservação de área com tolerância de 0,2%. Quando dois bairros oficiais se sobrepõem, subtrair a interseção duplicada de ambos para **não atribuir arbitrariamente** a área a nenhum dos dois. A porção ambígua é conservada como `__sobreposicao_oficial__` e reportada no diagnóstico.
3. Publicar cada interseção não ambígua como uma feição da camada vetorial PMTiles `hex_bairros`, com `bairro`, `cell`, `area_km2`, `share_pct` e `full`.
4. `full=1` significa que **toda a área do hexágono recortado ao município pertence ao bairro**; os indicadores publicáveis dessa célula podem ser mostrados no recorte.
5. `full=0` significa **fragmento de divisa**. Não copiar a contagem total para dois bairros nem estimar por fração de área. Os fragmentos aparecem em bege, sem valores.
6. Calcular em memória, a partir do CNEFE bruto de 2022, o bairro de cada endereço não residencial diretamente pelo teste `covers(ponto_observado)`. Publicar apenas contagens agregadas por bairro, com supressão de 1 a 4 observações; registrar pontos em limites ambíguos ou lacunas.
7. Calcular `observedPerKm2` a partir da contagem CNEFE por bairro e da área integral do seu polígono oficial. Essa taxa **não é** densidade de CNPJs ativos, não representa situação atual e não mede área útil urbanizada.
8. `cnpjPublishedFullCells` é a soma das contagens já publicáveis de CNPJs espacializados **somente** em células integralmente contidas no bairro. É um **subtotal do subconjunto geocodificado**, não o estoque empresarial do bairro. Não calcular taxas municipais com esse subtotal sem nota explícita.

## Privacidade e qualidade

- Coordenadas individuais de endereço ou CNPJ nunca integram os PMTiles. Geometria publicada: hexágono/fragmento, nunca ponto CNEFE.
- Contagens positivas de 1 a 4 são ocultadas; valor ausente não é zero. Nas células de divisa, não publicar contagem espacialmente subdividida nem extrapolada.
- A soma da área dos fragmentos deverá corresponder à área do hexágono municipal recortado dentro da tolerância.
- Para comparação empresarial por bairro completo, continuar utilizando a base separada de bairro declarado da Receita, com metodologia explícita. Para localização exata, usar somente os endereços RFB×CNEFE coincidentes e jamais extrapolá-los à totalidade.
- A seleção por bairro desativa calor suavizado, já que a kernelização não respeita a divisa administrativa.

## Campos públicos

`public/data/cnefe-hex500.json`:
- `spatialOverlayVersion=1`: geometria efetiva disponível.
- `spatialTopology.fullCellBairro`: mapeamento de hexágonos completamente contidos em bairro.
- `spatialTopology.neighborhoods`: áreas, células completas, fragmentos de divisa e contagens oficiais CNEFE observadas por bairro.
- `spatialTopology.crossBorderHexagons`, `fullyContainedHexagons`, `fragments`: estatísticas de controle.
- `coverage`: reconciliação do município, incluindo endereços sem correspondência territorial única.

`public/data/cnefe-hex500.pmtiles`: camadas `hex500`, `heat500`, `hotspots500` e `hex_bairros`.

## Execução e homologação

O gerador `scripts/collect_hex500.py` e o workflow `.github/workflows/bairros.yml` regeneram os artefatos com insumos oficiais e tests de integridade. Na página `/hex500`, selecione um bairro e confira os fragmentos de borda, o subtotal em células completas e a contagem CNEFE por bairro. O workflow de homologação browser testa a navegação e a versão mobile.

**Ambiguidade oficial:** `spatialTopology.ambiguousOfficialAreaKm2` quantifica a área de sobreposição sem atribuição; `ambiguousOfficialFragments` informa quantos fragmentos foram registrados. Isso não autoriza criar nem ajustar manualmente limites oficiais: a geometria-fonte deve ser auditada pelo GeoCanoas.
