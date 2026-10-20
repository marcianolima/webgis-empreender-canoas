# Atlas censitário 2022 — setores oficiais de Canoas

## Produtos e proveniência

O coletor obtém do IBGE a malha definitiva de setores 2022 do Rio Grande do Sul, o Básico revisado em 20/05/2026, Demografia, Características do Domicílio e Rendimento do Responsável revisado em 08/05/2026. Filtra somente Canoas (IBGE 4304606) e versiona os produtos municipais. ZIP estaduais/nacionais não são entregues ao navegador.

Fontes originais: [malha RS](https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios/malha_com_atributos/setores/shp/UF/RS/), [Agregados por Setor](https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios/Agregados_por_Setor_csv/) e [Rendimento do Responsável](https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios_Rendimento_do_Responsavel/). Dicionários de ambas as divulgações identificam cada variável; os códigos são validados antes de publicar.

Arquivos locais produzidos:

- `public/data/censo2022-setores.pmtiles` — malha e atributos de 659 setores em PMTiles v3.
- `public/data/censo2022-setores.geojson` — geometria filtrada, coordenadas WGS84, simplificada em 2,3 m para visualização.
- `public/data/censo2022-setores.json` — observações setoriais, dicionário, qualidade, cobertura e SHA256 de origem.
- `public/data/censo2022-setores-bairros.json` — interseções geométricas com os 18 bairros oficiais GeoCanoas, sem população inventada.

## Domínios, métricas e proteção estatística

Os **659 setores** somam **347.657 habitantes do Censo 2022**. Outros temas possuem dados para menos setores; ausência de observação, `X` ou `.` = **N/D**, não zero.

As densidades (pessoas ou domicílios ocupados/km²) utilizam área geométrica em SIRGAS 2000 / UTM 22S, EPSG:31982. Percentuais derivados são computados apenas quando numerador e denominador estão disponíveis. Valores monetários exprimem **rendimento nominal mensal de responsáveis com rendimento, em 2022**, não renda familiar, renda per capita ou série corrigida pela inflação.

Códigos cadastrais e os bairros declarados na Receita Federal não são dados de geocodificação de estabelecimentos nos setores. A comparação é apenas de **contexto territorial**. Não se atribuem endereços residenciais ou pontos individuais.

## Cruzamento topológico setor × bairro

O coletor mede a interseção de cada setor e cada bairro oficial em EPSG:31982, guardando a porcentagem de área e se a feição cruza divisas. Um setor limítrofe aparece na consulta de todos os bairros intersectados; **seus habitantes não são somados integralmente em cada bairro**.

O subtotal de habitantes nos setores **totalmente contidos** é um limite inferior observável. Adicionalmente existe a estimativa **modelada por rateio areal**, com hipóteses de população uniformemente distribuída no setor e ressalva explícita. Não equivale a uma contagem oficial IBGE/GeoCanoas por bairro e não deve ser comparada como crescimento.

O atributo `NM_BAIRRO` da malha IBGE é mantido sem pressupor equivalência ao bairro oficial GeoCanoas.

## Funcionalidades

A rota `/censo2022/` oferece seleção de dezenas de indicadores publicados nos quatro temas; mapa PMTiles, legenda por quantis, filtros de bairro oficial e situação do setor; busca pelo código; ranking clicável; histogramas e dispersão bivariada entre dois indicadores; exportação CSV; consulta à cobertura e N/D; e contexto de CNPJ declarado e CNEFE 2022, mantendo fontes separadas.

Nenhum indicador de 2022 é tratado como medição de 2026.

## Reprodutibilidade

O script `scripts/collect_censo2022_setores.py` utiliza pyshp, Shapely, pyproj, openpyxl e tippecanoe. O fluxo `.github/workflows/censo2022.yml` efetua download, validação, construção de PMTiles e commit dos quatro artefatos municipais. `tests/test_censo2022_setores.py` verifica a contagem de setores, população, geometria, sigilo, integridade e hashes.

O material não permite comparação direta com setores 2010 sem compatibilização da malha. Mapas correlacionais não demonstram causalidade nem localização individual de empresas.
