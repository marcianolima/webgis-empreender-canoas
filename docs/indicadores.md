# Dicionário de indicadores

**Grão:** estabelecimento identificado por CNPJ completo; contagem distinta. **Referência:** competência do lote da Receita Federal, informada em cada tela.

| Indicador | Regra inicial | Ressalva |
| --- | --- | --- |
| Estoque ativo | Situação cadastral = 02 | Retrato do mês; não equivale a empresas raiz |
| Aberturas | Data de início da atividade no intervalo | Pode incluir estabelecimento atualmente baixado |
| Baixas | Situação = 08 e data da situação no intervalo | Não captura histórico completo de eventos |
| Saldo | Aberturas − baixas no intervalo | Não é igual à diferença entre estoques necessariamente |
| % MEI | MEI = S / universo com condição MEI conhecida | Arquivo Simples necessário; denominador declarado |
| % Simples | Simples = S / universo elegível com condição conhecida | Não inferir por porte |
| Porte | Código cadastral da empresa (00,01,03,05) | Porte da pessoa jurídica, não necessariamente de cada unidade |
| Setor | CNAE principal do estabelecimento | Usar tabela oficial e agrupamento hierárquico versão CNAE |
| Ranking bairros | Bairro cadastral normalizado; em paralelo, bairro espacial com precisão informada | Comparar métodos e casos sem localização |

Amostra demonstrativa **não deve entrar** em qualquer série municipal ou ser exportada como informação oficial. Datas, universos, regras de tratamento de ausências, classificações e variantes metodológicas precisam constar no painel correspondente.
