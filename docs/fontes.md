# Fontes, proveniência e licenças

## Principal: Receita Federal — Dados Abertos do CNPJ

- Catálogo nacional: https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-da-pessoa-juridica---cnpj
- Leiaute oficial: https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf
- Periodicidade prevista: mensal, condicionada à publicação da RFB.
- Arquivos necessários: todos os fragmentos de **Estabelecimentos** e **Empresas** do mesmo lote; **Simples** para MEI e opção Simples; **Municipios** para filtro municipal; tabelas auxiliares de **CNAEs**, **Naturezas**, **Qualificacoes** conforme necessário.
- A tabela Empresas é por CNPJ básico; Estabelecimentos é por CNPJ completo.
- A referência deve ser a data do **lote da base**, não a data da execução do script.

## Geografia

- IBGE: https://www.ibge.gov.br/geociencias/organizacao-do-territorio/estrutura-territorial/26565-malhas-de-setores-censitarios-divisoes-intramunicipais.html (setores censitários e bairros 2022).
- GeoCanoas: https://geo.canoas.rs.gov.br/portal/ (priorizar polígonos e limites atualizados, quando públicos e licenciados).
- Município: código IBGE **4304606**; esse código **não** é o código interno da tabela Municipios da Receita Federal.
- Adotar CRS EPSG:4674/4326 para GeoJSON WGS84 e EPSG:31982 quando houver medições métricas locais, com transformações explícitas.
- Comparar versões de bairros: nomes, alterações de divisão e definição do limite adotado.

## Contrapontos e enriquecimento

- Mapa de Empresas: https://www.gov.br/empresas-e-negocios/pt-br/mapa-de-empresas (agregados e metodologias podem diferir do estoque CNPJ).
- IBGE (demografia): https://www.ibge.gov.br/
- OpenStreetMap (ODbL): https://www.openstreetmap.org/copyright
- Dados da Prefeitura: https://www.canoas.rs.gov.br/

## Registro obrigatório em cada publicação real

\`fonte\`, \`url_origem\`, \`referencia\`, \`data_coleta\`, \`versao_pipeline\`, \`licenca\`, \`sha256_do_arquivo\`, \`registros_entrada\`, \`registros_saida\`, \`regras_filtro\`, \`regras_agregacao\`, \`taxa_geocodificacao\` e \`restricoes\`.

**Nenhuma contagem oficial foi ingerida nesta primeira etapa.** Dados fictícios da interface são apenas demonstração.
