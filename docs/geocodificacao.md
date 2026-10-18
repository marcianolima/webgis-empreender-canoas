# Metodologia de geocodificação

## Objetivo

Converter **endereço cadastral** em localização espacial **estimada**, sem alegar confirmação de operação no local. A base CNPJ não fornece coordenadas geográficas confiáveis para esse fim.

## Normalização

1. Manter campos originais (tipo, logradouro, número, complemento, bairro, CEP, município).
2. Padronizar espaços, acentos e abreviações mantendo cópia original e registrando a versão do normalizador.
3. Selecionar apenas endereços compatíveis com Canoas/RS; verificar CEP e município com fonte oficial.
4. Remover dados de identificação pessoal ou conteúdo livre sensível que não seja necessário.

## Estratégia hierárquica (planejada, não executada)

1. **Endereço oficial municipal / ponto de numeração validado:** método \`endereco_oficial\`, confiança alta.
2. **Interpolação de número no eixo de logradouro oficial:** \`interpolado\`, média (não é porta do imóvel).
3. **Serviço de geocodificação por endereço completo:** \`geocoder\`, confiança conforme correspondência, termos de uso e validação.
4. **CEP ou segmento de rua:** \`cep_ou_via\`, baixa.
5. **Centroide de bairro:** \`bairro\`, aproximação territorial. **Não renderizar como posição pontual exata de um estabelecimento**.
6. **Falha / ambiguidade:** \`nao_geocodificado\`, sem coordenadas públicas.

Nunca distribuir pontos aleatoriamente nem usar coordenadas fictícias em produção. Nunca geocodificar dados pessoais em serviço de terceiros sem verificar bases legais, segurança e termos de uso.

## QA de geocodificação

Relatar, por versão da base e por bairro:
- Total elegível, total tentado, geocodificado (numérico e %), falhas e pendências.
- Percentual por método e faixa de confiança.
- Percentual de pontos dentro de Canoas e dentro do bairro esperado.
- Duplicidade de endereços, pontos coincidentes, CEP inválido e possíveis deslocamentos.
- Amostra auditada manualmente e taxa de acerto aferida.

### Definição

\`taxa_geocodificacao = registros_com_coordenada_validada / registros_elegiveis * 100\`.

**Atenção:** cobertura por bairro não é cobertura municipal. Ranking de bairros poderá usar bairro cadastral (não a geocodificação) com indicação de divergências.

## Transparência no mapa

Pop-ups devem identificar **origem da coordenada**, **nível de confiança**, **referência do cadastro**, e uma observação de que a localização pode ser aproximada. Não expor endereços de empresários individuais sem análise de risco LGPD. Políticas de arredondamento/agregação devem ser revisadas pela área responsável antes da publicação pública.

**Etapa 1:** sem geocodificação real. Coordenadas da demonstração são sintéticas e não correspondem a estabelecimentos.
