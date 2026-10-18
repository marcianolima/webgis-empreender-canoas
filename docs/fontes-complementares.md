# Fontes complementares: DataSebrae, RS em Dados, Mapa de Empresas e Dados RS

Atualizado em outubro/2026. **Nesta etapa não foram obtidos indicadores numéricos de Canoas desses painéis.** Catálogo da página \`/fontes\` é informativo até a ingestão real.

## Fontes verificadas

| Fonte | Página | Acesso confirmado e abordagem |
| --- | --- | --- |
| DataSebrae — Abertura | https://datasebrae.com.br/aberturadeempresas/ | Painel público indicado pelo usuário; não foi comprovada API pública ou exportação padronizada. Consulta externa até obter arquivo de dados legítimo. |
| DataSebrae — Tempo | https://datasebrae.com.br/tempo-de-abertura-de-empresa/ | Painel público indicado pelo usuário; metodologia/unidades e acesso estruturado pendentes de confirmação direta. |
| RS em Dados | https://rsemdados.com.br/ | Plataforma Invest RS com mapas e dashboards de empresas, economia, força de trabalho e comércio exterior. API/extração direta não confirmada. |
| Mapa de Empresas (gov.br) | https://www.gov.br/empresas-e-negocios/pt-br/mapa-de-empresas/painel-mapa-de-empresas | **Exportação manual de objetos/tabelas documentada** no [manual oficial de junho/2026](https://www.gov.br/empresas-e-negocios/pt-br/mapa-de-empresas/arquivos/MANUALMAPADEEMPRESASv2.pdf/@@display-file/file). |
| Dados RS (CKAN) | https://dados.rs.gov.br/ | Conjuntos CSV abertos, incluindo [constituições](https://dados.rs.gov.br/dataset/empresas-constituidas), [extinções](https://dados.rs.gov.br/dataset/extincao-empresas) de empresas JUCISRS e [PIB](https://dados.rs.gov.br/dataset/dee-4575). Cada recurso tem sua própria granularidade, série, licença e definição. |

**Importante:** visualizar um relatório público do Power BI não concede, por si só, credenciais de API REST, acesso a dataset interno nem autorização para reutilizar todos os registros. Não foram implementadas chamadas a endpoints internos ou autenticação improvisada.

## Como obter e importar indicadores

1. Acesse a **fonte original** e selecione o território Canoas/RS, período e demais filtros (se disponíveis).
2. Exporte os dados pelo mecanismo oficial oferecido. No Mapa de Empresas, o [manual oficial](https://www.gov.br/empresas-e-negocios/pt-br/mapa-de-empresas/arquivos/MANUALMAPADEEMPRESASv2.pdf/@@display-file/file) orienta \`Exportar Dados\` e \`Baixar como → Dados\`.
3. Preserve o arquivo bruto **fora do repositório** (\`data/raw/\`), registre URL do relatório, competência, data da extração, filtros e versão da metodologia.
4. Revise colunas, categorias, unidades e totalizadores. Não presuma que a exportação já obedece ao esquema desta aplicação.
5. Transforme somente **observações agregadas** em uma planilha com o cabeçalho de \`docs/modelo-indicadores-externos.csv\` (CSV UTF-8 com \`;\`).
6. Revise cada linha, incluindo \`universo\` e \`metodologia\`.
7. Execute:

\`\`\`bash
python scripts/import_external_indicators.py \
  --input data/raw/indicadores-revisados.csv \
  --append
\`\`\`

8. Confira \`src/data/external-indicators.json\` e os resultados em \`/fontes\`. Submeta PR, faça revisão da fonte e publique após homologação.

### Esquema canônico (11 colunas)

| Campo | Regra |
| --- | --- |
| \`fonte\` | \`datasebrae_aberturas\`, \`datasebrae_tempo\`, \`rs_em_dados\`, \`mapa_empresas\`, \`dados_rs\` |
| \`indicador\` | \`aberturas\`, \`baixas\`, \`ativas\`, \`tempo_abertura_horas\`, \`tempo_viabilidade_horas\`, \`tempo_registro_horas\`, \`pib_brl\`, \`empregos_formais\`, \`exportacoes_usd\` |
| \`competencia\` | Ano \`AAAA\` ou mês \`AAAA-MM\` conforme granularidade original. |
| \`territorio\` | Código IBGE \`4304606\` para Canoas ou \`43\` para RS. |
| \`valor\` | Número não negativo; inteiros para contagens e decimais quando cabíveis. |
| \`unidade\` | \`empresas\`, \`estabelecimentos\`, \`horas\`, \`BRL\`, \`USD\`, \`vinculos\`. |
| \`universo\` | Universo estatístico exato (ex.: empresas matrizes registradas, exclui MEI). |
| \`segmento\` | Recorte adicional (ex.: Total, MEI, seção CNAE G), quando existente. |
| \`extraido_em\` | Data efetiva de consulta/exportação (\`AAAA-MM-DD\`). |
| \`url_origem\` | Link HTTPS para a página/recurso da **fonte cadastrada**. |
| \`metodologia\` | Breve descrição de filtros, interpretação e eventual limitação/ruptura. |

O importador recusa duplicidade dentro do arquivo, territórios distintos de Canoas/RS, domínios incompatíveis com a fonte e números negativos. O modo \`--append\` mantém outras competências e substitui chave equivalente de fonte/indicador/território/universo/segmento/período. Os testes utilizam **somente arquivos fictícios temporários**, não constroem série falsa na interface.

### Exemplo de origem sem números inventados

\`\`\`csv
fonte;indicador;competencia;territorio;valor;unidade;universo;segmento;extraido_em;url_origem;metodologia
\`\`\`

Preencher valores apenas após conferência documental. **Não carregar totais estaduais como se fossem valores municipais.**

## Cuidados de comparabilidade

- Aberturas/baixas de **empresas** podem considerar só matrizes; o projeto CNPJ conta **estabelecimentos** (matriz + filial). Reportar os dois universos separadamente e não comparar por subtração direta.
- A definição de MEI/ME/EPP do painel externo pode divergir do código de porte das tabelas abertas de empresas; informar filtros/regras.
- Indicadores de tempo vêm de **eventos da REDESIM**, não das datas do CNPJ. No Mapa de Empresas, o manual explica que MEI não integra o cálculo do tempo de abertura e que períodos de responsabilidade do requerente não são contados.
- **Quebra de série:** novo fluxo tributário MAT passou a alterar o tempo apurado a partir de **dezembro/2025**; apresentar nota ao comparar meses anteriores e posteriores. Consulte o [manual do Mapa de Empresas](https://www.gov.br/empresas-e-negocios/pt-br/mapa-de-empresas/arquivos/MANUALMAPADEEMPRESASv2.pdf/@@display-file/file).
- JUCISRS: empresas constituídas/extintas por natureza jurídica têm universo administrativo próprio e podem se referir ao **RS agregado**, não a Canoas. Verifique explicitamente granularidade municipal antes de atribuir qualquer valor ao município.
- Indicadores de economia/PIB, força de trabalho e comércio internacional exigem unidades e referências próprias; não usar totais regionais como valores municipais.
- O arquivo resultante só contém observações agregadas; endereço e identificação de empresas devem permanecer fora desta exportação.

## Passos posteriores

- Validar diretamente interfaces DataSebrae e RS em Dados, exportações, termos de reutilização e eventuais endpoints documentados.
- Criar adaptadores específicos por leiaute de exportação disponibilizado; evitar scraping dependente de DOM privado.
- Automatizar conjuntos CSV públicos do Dados RS apenas após verificar o recurso, data, licença, unidade territorial e esquema.
- Implementar checagens cruzadas com CNPJ por universo e competência, com divergências justificadas, sem substituir os KPIs internos.

## REDESIM/JucisRS — dados de viabilidade, registro e tempo

- Fluxo oficial: https://www.redesim.rs.gov.br/.
- Painel de estatísticas: https://www.gov.br/empresas-e-negocios/pt-br/mapa-de-empresas/painel-mapa-de-empresas.
- O painel Mapa de Empresas declara que a partir de dezembro/2025 a implantação do MAT alterou os tempos reportados.
- Registro de tempo vem de processos REDESIM, não da diferença entre datas CNPJ.
- Não foi encontrada API pública aberta que permita colher todos os tempos de Canoas diretamente sem autenticação. Painéis Power BI não autorizam automaticamente endpoints privados.
- Importação suportada em `scripts/import_external_indicators.py` com `fonte=redesim_jucisrs` ou `fonte=mapa_empresas`. É necessário extrair por mecanismo oficial e preencher competência, IBGE 4304606, universo, unidade, segmento e URL de origem, preservando arquivo original e licença.
- O painel `/redesim` exibe dados validados, ou informação explícita de indisponibilidade (nunca estimativa).
