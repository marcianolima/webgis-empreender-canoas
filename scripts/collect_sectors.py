#!/usr/bin/env python3
"""Indicadores setoriais de Canoas via tabelas oficiais do IBGE/SIDRA.

A fonte é o levantamento PAM, PPM, PEVS e PIB municipal. Nunca reutiliza dados
estaduais como dados locais, nem substitui indisponibilidade por estimativas.
"""
from __future__ import annotations
import json
import sys
from datetime import datetime,timezone
from pathlib import Path
from collect_official import get_json, numeric

IBGE="https://servicodados.ibge.gov.br/api/v3/agregados"
TERRITORY="4304606"
TABLES=[
    ("agricultura",5457,[216,214,215],782),
    ("pecuaria",3939,[105],79),
    ("extracao_vegetal",289,[144,145],193),
]
VARS={
    216:"area_colhida",214:"quantidade_produzida",215:"valor_producao",
    105:"efetivo_rebanhos",144:"quantidade_extrativa",145:"valor_extrativo",
    513:"vab_agropecuaria",
}

def key_category(classification):
    for cls in classification or []:
        cats=cls.get("categoria",{})
        if cats:
            return next(iter(cats))
    return None

def read_table(group, table, variables, classification):
    meta=get_json(f"{IBGE}/{table}/metadados")
    last=int(meta["periodicidade"]["fim"])
    mapping=next((c for c in meta.get("classificacoes",[])
                  if int(c["id"])==classification),None)
    if not mapping:
        raise ValueError("Classificação SIDRA alterada")
    categories={str(c["id"]):c["nome"] for c in mapping["categorias"] if c.get("nivel")!=0}
    query=(f"{IBGE}/{table}/periodos/{last}/variaveis/"
           + "%7C".join(str(v) for v in variables)
           + f"?localidades=N6%5B{TERRITORY}%5D&classificacao={classification}%5Ball%5D")
    output=[]
    for variable in get_json(query):
        vid=int(variable["id"])
        if vid not in variables:
            raise ValueError("Variável SIDRA inesperada")
        for result in variable.get("resultados",[]):
            cls=next((c for c in result.get("classificacoes",[])
                      if int(c["id"])==classification),None)
            if not cls:
                continue
            for cat in cls.get("categoria",{}):
                if cat not in categories:
                    continue
                for series in result.get("series",[]):
                    if str(series.get("localidade",{}).get("id"))!=TERRITORY:
                        continue
                    raw=series.get("serie",{}).get(str(last),"")
                    val=0 if raw=="-" else numeric(raw)
                    if val is None:
                        continue
                    output.append({
                        "group":group, "year":last, "metric":VARS[vid],
                        "category":cat, "label":categories[cat], "value":val,
                        "unit":variable.get("unidade",""),
                        "sourceTable":table,
                        "sourceUrl":f"https://sidra.ibge.gov.br/tabela/{table}",
                        "territory":TERRITORY,
                    })
    return output

def read_vab():
    last=2023
    query=f"{IBGE}/5938/periodos/{last}/variaveis/513?localidades=N6%5B{TERRITORY}%5D"
    data=get_json(query)
    out=[]
    for item in data:
        if int(item.get("id",-1))!=513:
            continue
        for result in item.get("resultados",[]):
            for series in result.get("series",[]):
                if str(series.get("localidade",{}).get("id"))!=TERRITORY:
                    continue
                val=numeric(series.get("serie",{}).get(str(last),""))
                if val is not None:
                    out.append({"group":"vab_agropecuaria","year":last,
                        "metric":"vab_agropecuaria","category":"total",
                        "label":"Valor adicionado bruto da agropecuária",
                        "value":val,"unit":"Mil Reais", "sourceTable":5938,
                        "sourceUrl":"https://sidra.ibge.gov.br/tabela/5938",
                        "territory":TERRITORY})
    return out

def main():
    report={
        "schemaVersion":1,"status":"partial",
        "generatedAt":datetime.now(timezone.utc).isoformat(),
        "territory":"4304606", "municipality":"Canoas",
        "observations":[],"quality":{"errors":[],"notes":[
            "Valores de cada produto não são somados entre unidades de medida incompatíveis.",
            "Informações não disponíveis são omitidas, nunca inventadas.",
            "Indicadores de turismo e comércio exterior dependem de suas fontes específicas; a agropecuária não é proxy de turismo.",
            "As séries publicadas referem-se ao ano de cada tabela, não ao exercício corrente do CNPJ.",
        ]}
    }
    for group,table,vars,cls in TABLES:
        try:
            rows=read_table(group,table,vars,cls)
            report["observations"].extend(rows)
            print("OK",group,len(rows),flush=True)
            if not rows:report["quality"]["errors"].append(f"{group}: sem dados municipais no último ano")
        except Exception as ex:
            report["quality"]["errors"].append(f"{group}: {ex}")
            print("AVISO",group,ex,flush=True)
    try:
        rows=read_vab()
        report["observations"].extend(rows)
        print("OK vab_agropecuaria",len(rows),flush=True)
    except Exception as ex:
        report["quality"]["errors"].append(f"vab_agropecuaria: {ex}")
    if not report["observations"]:
        raise RuntimeError("Sem nenhuma observação municipal verificada. Snapshot anterior preservado.")
    report["status"]="ok" if not report["quality"]["errors"] else "partial"
    assert all(row["territory"]=="4304606" and row["year"]>=2020 for row in report["observations"])
    dest=Path("public/data/sectors.json")
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(report,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print("SETORIAIS_PUBLICADOS",len(report["observations"]),"falhas",report["quality"]["errors"],flush=True)

if __name__=="__main__":
    try:main()
    except Exception as ex:
        print("ERRO (sem sobrescrever base anterior):",repr(ex),file=sys.stderr)
        sys.exit(1)
