#!/usr/bin/env python3
"""Canoas / Sebrae OST: apenas dados públicos estruturados no perfil municipal.

Nunca consulta sessão autenticada, endpoints ocultos, nem contorna restrições.
Lê __NEXT_DATA__ publicado no HTML público e seleciona APENAS valores numéricos
agregados do município IBGE 4304606. Arquiva separadamente narrativas já
conferidas com data explícita para evitar atualizar datas ficticiamente.
"""
from __future__ import annotations
import datetime as dt
import html
import json
import math
import re
import sys
import urllib.request
from pathlib import Path

URL="https://observatorio.sebrae.com.br/profile/geo/canoas"
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"public/data/sebrae.json"
ARCHIVE=ROOT/"src/data/sebrae-archive-2026-10.json"
GROUPS={
  "empresas":"Empresas e empreendedorismo",
  "emprego":"Emprego e mercado de trabalho",
  "ocupacoes":"Ocupações e qualificação profissional",
  "demografia":"Demografia e mercado consumidor",
  "educacao":"Educação e capital humano",
  "financas":"Finanças e capacidade municipal",
  "desenvolvimento":"Desenvolvimento e inclusão",
  "agro":"Agronegócio",
  "comercio":"Comércio exterior",
}

def get_public_page():
    req=urllib.request.Request(URL,headers={
      "User-Agent":"Mozilla/5.0 (compatible; CanoasEmpreende-public-data/1.0)",
      "Accept":"text/html","Accept-Encoding":"identity",
    })
    with urllib.request.urlopen(req,timeout=45) as res:
        if res.status!=200 or not res.geturl().startswith("https://observatorio.sebrae.com.br/"):
            raise ValueError("Fonte ou redirecionamento inesperado")
        raw=res.read(2_500_001)
        if len(raw)>2_500_000:raise ValueError("HTML maior que o limite operacional")
    text=raw.decode("utf-8")
    match=re.search(r'<script[^>]+id="__NEXT_DATA__"[^>]*>(.*?)</script>',text,re.S)
    if not match:raise ValueError("HTML público não contém payload Next.js")
    return json.loads(html.unescape(match.group(1)))

def valid_num(value,allow_zero=False):
    if type(value) not in (int,float) or not math.isfinite(value):
        raise ValueError(f"Número inválido: {value!r}")
    if value<0 or (value==0 and not allow_zero):
        raise ValueError(f"Número municipal ausente/inválido: {value!r}")
    return value

def read_var(mapping, id, key, allow_zero=False):
    values=mapping.get(str(id),{})
    if key not in values:
        raise ValueError(f"Indicador público ausente no componente {id}/{key}")
    return valid_num(values[key],allow_zero=allow_zero)

def observation(code,theme,label,year,value,unit,provider,period=None,notes=None):
    val=valid_num(value)
    if not (2000<=year<=dt.date.today().year):
        raise ValueError("Ano fora da janela verificada")
    return {"code":code,"theme":theme,"label":label,"year":year,
       "period":period or str(year),"value":val,"unit":unit,
       "provider":provider,"notes":notes or "",
       "sourceUrl":URL}

def main():
    payload=get_public_page()
    pp=payload["props"]["pageProps"]
    entity=pp["profileProps"]
    if str(entity.get("id"))!="4304606" or entity.get("slug")!="canoas":
        raise ValueError(f"Município incorreto no payload: {entity}")
    vars=pp["initialState"]["variables"]["variables"]
    now=dt.datetime.now(dt.timezone.utc).isoformat()
    metrics=[]
    def add(code,theme,label,year,value,unit,provider,period=None,notes=None):
        metrics.append(observation(code,theme,label,year,value,unit,provider,period,notes))

    raisyear=int(read_var(vars,34,"yearRaisW"))
    add("rais_vinculos","emprego","Vínculos de emprego formal (RAIS)",raisyear,read_var(vars,34,"workersCurr"),"vínculos","RAIS/MTE",notes="Vínculos formais; não equivalem a pessoas economicamente ativas.")
    add("rais_remuneracao","emprego","Remuneração média nominal",raisyear,round(read_var(vars,34,"salaryCurr"),2),"BRL/mês","RAIS/MTE",notes="Média nominal mensal; não corrigida por inflação.")
    add("rais_estabelecimentos","emprego","Estabelecimentos declarantes RAIS",int(read_var(vars,35,"yearRaisE")),read_var(vars,35,"establishmentCurr"),"estabelecimentos","RAIS/MTE",notes="Cobertura da RAIS, diferente do estoque cadastral de CNPJs.")
    add("rais_variacao_vinculos","emprego","Variação anual dos vínculos formais",raisyear,round(vars["34"]["deltaWorkers"],4),"%","RAIS/MTE",notes="Porcentagem RAIS sobre ano anterior; não equivale ao saldo do Novo Caged.")
    add("rais_remuneracao_mulheres","emprego","Remuneração média nominal — mulheres",raisyear,round(read_var(vars,39,"womenSalary"),2),"BRL/mês","RAIS/MTE")
    add("rais_remuneracao_homens","emprego","Remuneração média nominal — homens",raisyear,round(read_var(vars,39,"menSalary"),2),"BRL/mês","RAIS/MTE")
    add("rais_participacao_mulheres","emprego","Vínculos de mulheres no total",raisyear,round(read_var(vars,39,"womenPct"),2),"%","RAIS/MTE")
    add("rais_participacao_homens","emprego","Vínculos de homens no total",raisyear,round(read_var(vars,39,"menPct"),2),"%","RAIS/MTE")
    add("rf_empresas_ativas_sebrae","empresas","Empresas ativas — fotografia Sebrae",2026,read_var(vars,519,"companiesActive"),"estabelecimentos","Receita Federal via Sebrae","2026-10",notes="Fotografia do perfil Sebrae; comparar somente após harmonizar filtros e momento exato de extração RFB.")
    add("sebrae_atendimentos","empresas","Empresas atendidas pelo Sebrae — últimos três anos",2026,read_var(vars,945,"totalSebraeCompanies"),"empresas atendidas","Sebrae OST","Últimos três anos até 2026-10",notes="Clientes Sebrae, não estoque de empresas; setor Agricultura cobre apenas CNPJs.")
    add("sebrae_atendimentos_servicos","empresas","Atendimentos do Sebrae — setor Serviços",2026,read_var(vars,945,"mainSectorValue"),"empresas atendidas","Sebrae OST","Últimos três anos até 2026-10")
    add("pop_estimativa_sebrae","demografia","População estimada",int(read_var(vars,506,"lastYearPop")),read_var(vars,506,"population"),"pessoas","IBGE via Sebrae",notes="Estimativa IBGE, não Censo.")
    add("educacao_superior_matriculas","educacao","Matrículas no ensino superior",int(read_var(vars,513,"lastYearInep")),read_var(vars,513,"enrollments"),"matrículas","INEP via Sebrae")
    add("enem_pontuacao_divulgada","educacao","Indicador ENEM exibido pelo Sebrae",int(read_var(vars,512,"lastYearEnem")),round(read_var(vars,512,"enemScore"),2),"pontos","INEP via Sebrae",notes="Critério/agregação do valor no painel exige conferência antes de qualquer ranking; não é nota média simples dos participantes.")
    add("agro_valor_principal_produto","agro","Valor da produção do produto agrícola principal",int(read_var(vars,770,"anoAgro")),read_var(vars,770,"producaoAgro"),"BRL","PAM/IBGE via Sebrae",notes="Produto principal no recorte; série primária de agricultura fica em /setores.")
    add("pecuaria_principal_rebanho","agro","Quantidade do rebanho principal",int(read_var(vars,772,"anoPec")),read_var(vars,772,"cabecasPec"),"cabeças","PPM/IBGE via Sebrae")
    add("siconfi_transferencias_correntes","financas","Receitas de transferências correntes",int(read_var(vars,1023,"lastYear")),read_var(vars,1023,"transferenciasCorrentes"),"BRL","SICONFI/STN",notes="Receitas correntes de transferências; consultar metadados da rubrica antes de comparações.")
    add("siconfi_receitas_correntes","financas","Receitas correntes — denominador do perfil",int(read_var(vars,1023,"lastYear")),read_var(vars,1023,"totalMun"),"BRL","SICONFI/STN",notes="Total conforme indicador do perfil; não confundir com receita orçamentária total municipal.")
    add("siconfi_participacao_transferencias","financas","Participação das transferências nas receitas correntes",int(read_var(vars,1023,"lastYear")),round(100*read_var(vars,1023,"transferenciasCorrentes")/read_var(vars,1023,"totalMun"),2),"%","SICONFI/STN",notes="Calculado sobre numerador e denominador publicados no mesmo componente.")
    # SICONFI apresenta séries de natureza diferente em outras visualizações.
    # Não agregar automaticamente 'despesas empenhadas per capita' sem auditoria.

    history={}
    series=vars.get("448",{}).get("dataWorkers",[])
    if not (isinstance(series,list) and len(series)>=2):
        raise ValueError("RAIS: série histórica ausente")
    for yearrow in series:
        y=int(valid_num(yearrow["Year"]))
        if y>raisyear or y<2000:raise ValueError("Ano RAIS inválido")
        for code,key in (("rais_vinculos","Workers"),("rais_remuneracao","Remuneration Avg Nominal")):
            history.setdefault(code,[]).append({"year":y,"value":round(valid_num(yearrow[key]),2)})
    for code,items in history.items():
        items.sort(key=lambda row:row["year"])
        if len(set(row["year"] for row in items))!=len(items):
            raise ValueError("Ano duplicado na RAIS")
    # Série de estabelecimentos pode ter universo distinto no resumo; não exibir
    # sem reconciliar a diferença entre os blocos de dados do próprio Sebrae.

    reference=json.loads(ARCHIVE.read_text(encoding="utf-8"))
    if reference.get("municipalityIbgeCode")!="4304606" or reference.get("observedOn")!="2026-10-18":
        raise ValueError("Arquivo de referência histórica inválido")
    archived=reference["observations"]
    assert len({x["code"] for x in metrics})==len(metrics)
    assert len({x["code"] for x in archived})==len(archived)
    assert len(metrics)>=15 and len(archived)>=12
    data={"schemaVersion":1,"status":"verified","municipality":"Canoas",
        "municipalityIbgeCode":"4304606","sourceUrl":URL,
        "generatedAt":now,"sebraeBuildTime":pp.get("buildTime"),
        "groups":GROUPS,"metrics":metrics,"history":history,
        "archived":{"observedOn":reference["observedOn"],
           "observations":archived},
        "quality":{"notes":[
          "Fonte complementar: perfil público Observatório Setorial Territorial/Sebrae. Cada item indica a fonte primária da estatística.",
          "Indicadores em destaque do Sebrae não constituem uma cópia nem substituição da fonte oficial primária; diferentes filtros/cargas podem gerar diferenças frente ao CNPJ RFB.",
          "Registros do próprio portal com possível mudança de filtro ou universo não são unidos automaticamente (RAIS estabelecimentos, ocupações e ENEM).",
          "Os valores históricos de narrativas do perfil foram arquivados na data de observação e não são apresentados como coleta atualizada.",
          "Comércio exterior: zero no ano em curso não é presumido como ausência real de exportações; usar Comex Stat/MDIC.",
          "Educação, saúde e finanças públicas são variáveis de contexto do desenvolvimento econômico e requerem recortes e metodologias próprios.",
          "Séries longas do PIB, CEMPRE, CNPJ, DEE e IBGE mantêm-se nas rotas específicas do observatório.",
          "Não são reproduzidos gráficos, código ou textos extensos de terceiros. Publicam-se fatos numéricos agregados e citações à fonte.",
        ],
        "limits":[
          {"topic":"ENEM","reason":"Pontuação do painel depende de universo/filtro; confirmar método antes de rankings municipais."},
          {"topic":"Despesas SICONFI per capita","reason":"A narrativa e bases do perfil apresentam grandezas cuja rubrica precisa ser auditada; publicação suspensa."},
          {"topic":"Comex 2026 zero","reason":"Painel pode depender de filtro e ano parcial; não publicar como exportações nulas."},
          {"topic":"Ocupações por porte","reason":"Subuniversos dos filtros diferem do total de vínculos RAIS; não somar diretamente."},
        ]},
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    tmp=OUT.with_suffix(".tmp")
    tmp.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    tmp.replace(OUT)
    print("SEBRAE_OK",json.dumps({"status":data["status"],"municipio":data["municipalityIbgeCode"],
       "numerics":len(metrics),"archived":len(archived),
       "historyYears":[x["year"] for x in history["rais_vinculos"]],
       "rais":read_var(vars,34,"workersCurr"),
       "active_sebrae":read_var(vars,519,"companiesActive")},ensure_ascii=False),flush=True)

if __name__=="__main__":
    try:main()
    except Exception as error:
        print("SEBRAE_FAIL (snapshot anterior preservado):",repr(error),file=sys.stderr,flush=True)
        raise SystemExit(1)
