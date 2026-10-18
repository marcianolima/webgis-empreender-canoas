# Sebrae Tesseract — séries temporais e comparativos municipais

Fonte: https://observatorio.sebrae.com.br/profile/geo/canoas.
API observada (acesso público HTTP 200): https://apiv2-observatorio.sebrae.com.br/tesseract/cubes.

## Escopo e resultados

A API divulga 87 cubos no catálogo. O arquivo scripts/sebrae_series_specs.json define cada combinação de dimensões e medidas a materializar para Canoas (IBGE 4304606), separadamente do inventário de todos os cubos. A coleta realizada em GitHub Actions gera public/data/sebrae-series.json, com dados agregados de cada série, unidade, proveniência, filtros, ano e status de cobertura.

Históricos reproduzidos: vínculos ativos RAIS, remunerações, sexo, setor econômico, escolaridade, ocupações, porte; movimentação mensal Caged; CNPJ por situação, porte, CNAE, natureza e ano de abertura; atendimento Sebrae; REDESIM tempos; comércio exterior MDIC por ano/mês, país e SH2; receitas/despesas SICONFI; educação INEP, ENEM, IDEB; demografia IBGE e PNUD; agropecuária, banco, crédito rural, conectividade, compras públicas, turismo e alguns contextos de saúde.

## Exemplo auditado de consulta

GET /tesseract/data.jsonrecords?cube=RAIS_workers&drilldowns=Year&measures=Workers&Municipality=4304606&Active%20worker%20indicator=1

**Sem o filtro de ativo** a API retornou 155.787 vínculos em 2025, sendo 60.432 inativos e 95.355 ativos. O filtro é necessário para reproduzir a métrica do perfil. A ferramenta valida esse total a cada carga antes de publicar.

## Comparabilidade

* Não somar médias salariais, taxas de escolaridade, índices, tempo médio REDESIM nem outros indicadores não aditivos.
* SICONFI: níveis da contabilidade municipal podem se sobrepor; não somar categorias pai com suas filhas.
* Comex Stat: município do domicílio fiscal; US$ FOB não é quilograma.
* RAIS: estoque de vínculos ativos anuais; Caged: admissões e desligamentos mensais.
* Receita Federal: estabelecer o universo de situação cadastral e porte, pois o cadastro Sebrae pode ser extraído em outra data.
* PIB e VAB: manter série antiga 2021 e ressalvas 2022–2023 do IBGE.
* Alguns cubos são publicados sem o nível Municipality ou não retornam observações Canoas; o catálogo não implica disponibilidade numérica.

## Atualização e retenção

O workflow sebrae-series.yml executa a extração no GitHub Actions, testa integridade/municipalidade, anexa artefato da execução, e somente depois comita o agregado. Conflitos de commit são evitados com reset para a main atual e reaplicação do arquivo validado. Falhas de consultas individuais preservam a fotografia anterior com marca "stale"; exceções não se transformam em zeros.

Atualização mensal. Uso de dados publicados anonimamente, sem autenticação, tokens, captura de registros individuais ou reprodução de código/arte do Sebrae.

## Limites

Reproduzir as consultas especificadas não equivale a materializar a totalidade combinatória de 87 cubos vezes todas as dimensões e filtros. O explorador relaciona o que está efetivamente em cache e o que está apenas catalogado. Para novos cruzamentos acrescentar especificações auditáveis e verificar unicidade, unidade, origem e cobertura antes da publicação.

## Consulta multidimensional ad hoc

A interface `/sebrae/consulta` oferece consultas adicionais sobre **qualquer cubo do catálogo que possua dimensão Município**, executadas pelo navegador a partir da API Tesseract pública, com autorização CORS confirmada para `marcianolima.github.io`. A consulta adiciona sempre `Municipality=4304606`; RAIS_workers usa `Active worker indicator=1` e RF usa `Registration Status=2` por padrão, com explicação visível. Permite selecionar cubo, medida, eixo, comparação, ano, membros de dimensões, gráfico e exportação. Limite de 3.000 linhas e supressão de contagens 1–4. Cubos sem dimensão municipal ficam indisponíveis para evitar agregações nacionais apresentadas como Canoas.

**Diferença crucial:** modo histórico (`/sebrae/series`) serve dados auditados/persistidos no GitHub. Modo de consulta (`/sebrae/consulta`) obtém observações atuais sob demanda e depende da API pública estar operante; não persiste automaticamente resultados individuais no repositório. Essa abordagem cobre combinatoriamente mais filtros sem duplicar a infraestrutura de cálculo.
