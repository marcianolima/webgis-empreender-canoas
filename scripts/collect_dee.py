#!/usr/bin/env python3
"""Extração municipal oficial DEE/DataRS (exportações e vínculos formais).

Downloads públicos CSV com referência IBGE 4304606. Sem extrapolar anos,
sem transformar ausência em zero, sem confundir vínculos RAIS com pessoas.
"""
from __future__ import annotations
import csv
import io
import json
import re
import sys
import urllib.request
from datetime import datetime,timezone
from pathlib import Path

SOURCES={
  "exportacoes_usd": {
    "url":"https://data.rs.gov.br/download/dee-4949.csv",
    "unit":"US$ FOB",
    "label":"Exportações municipais",
    "source":"DEE/DataRS — Exportações total",
    "minYear":2010,
  },
  "vinculos_formais": {
    "url":"https://data.rs.gov.br/download/dee-5483.csv",
    "unit":"vínculos",
    "label":"Vínculos empregatícios formais",
    "source":"DEE/DataRS — Emprego, vínculos empregatícios, total",
    "minYear":2022,
  },
}
IBGE="4304606"

def download(url):
    if not url.startswith("https://data.rs.gov.br/download/dee-"):
        raise ValueError("Origem não reconhecida")
    with urllib.request.urlopen(
      urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (CanoasEmpreende/1.0)","Accept-Encoding":"identity"}),
      timeout=35) as response:
        content=response.read(3_000_000)
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError:
        return content.decode("latin-1")

def number(value):
    text=str(value).strip()
    if text in ("","-","...","..","X","x"):
        return None
    if not re.fullmatch(r"\d{1,3}(\.\d{3})*|\d+",text):
        raise ValueError("Valor numérico inesperado: "+repr(text))
    return int(text.replace(".",""))

def extract_csv(body, sourceId, info):
    lines=body.splitlines()
    start=next((i for i,line in enumerate(lines) if ('"ibge"' in line.lower() and "Munic" in line)),None)
    if start is None:
        raise ValueError("Colunas IBGE/município não encontradas")
    reader=csv.DictReader(io.StringIO("\n".join(lines[start:])+"\n"))
    if not reader.fieldnames:
        raise ValueError("CSV sem colunas")
    name_col=next((k for k in reader.fieldnames if k.lower()=="ibge"),None)
    if name_col is None:
        raise ValueError("Ausência da coluna ibge")
    years=[]
    for column in reader.fieldnames:
        found=re.search(r"\b(20\d{2})\b",column)
        if found and int(found.group(1))>=info["minYear"]:
            years.append((column,int(found.group(1))))
    if not years:
        raise ValueError("Não foram detectados anos válidos na fonte")
    total=0
    municipal=None
    for row in reader:
        if not row or not row.get(name_col):
            continue
        total+=1
        if row[name_col].strip()==IBGE:
            if municipal is not None:
                raise ValueError("Duplicidade do município 4304606")
            municipal=row
    if total<450 or municipal is None:
        raise ValueError(f"Conjunto estadual incompleto ou Canoas ausente: {total} municípios")
    result=[]
    for column,year in years:
        value=number(municipal.get(column,""))
        if value is not None:
            result.append({
                "metric":sourceId, "year":year, "value":value,
                "unit":info["unit"],"territory":IBGE,
                "label":info["label"],"source":info["source"],"sourceUrl":info["url"]
            })
    if not result:
        raise ValueError("Canoas sem série válida")
    return sorted(result,key=lambda r:r["year"]),total

def main():
    output={"schemaVersion":1,"status":"partial",
      "territory":IBGE,"municipality":"Canoas",
      "generatedAt":datetime.now(timezone.utc).isoformat(),
      "observations":[],"quality":{"errors":[],"notes":[
          "Exportações em US$ FOB, não em reais.",
          "Vínculos RAIS podem incluir múltiplos vínculos por pessoa. Não são indivíduos únicos nem desemprego.",
          "Cada ano é extraído diretamente das colunas do arquivo oficial, sem projeção ou interpolação.",
          "Colunas sem valor publicado não são tratadas como zero.",
      ]}}
    for key,info in SOURCES.items():
        try:
            data,count=extract_csv(download(info["url"]),key,info)
            output["observations"].extend(data)
            print("OK DEE",key,"municípios",count,"anos",[row["year"] for row in data],flush=True)
        except Exception as ex:
            output["quality"]["errors"].append(key+": "+str(ex))
            print("AVISO DEE",key,ex,flush=True)
    if not output["observations"]:
        raise RuntimeError("Nenhuma série municipal confirmada; manter dados anteriores")
    output["status"]="ok" if not output["quality"]["errors"] else "partial"
    dest=Path("public/data/dee.json")
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(output,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print("DEE_PUBLICADO",len(output["observations"]),"observações municipais",flush=True)

if __name__=="__main__":
    try:main()
    except Exception as ex:
        print("ERRO (sem publicação parcial):",repr(ex),file=sys.stderr)
        sys.exit(1)
