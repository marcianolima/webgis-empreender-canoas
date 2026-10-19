#!/usr/bin/env python3
"""Reconcile and correct CNPJ time-series using original 10 approved RFB shards.

ONLY dates are changed, never other indicators, establishment details or
geospatial counts. The old incorrect order must reproduce the published
snapshot exactly, otherwise the pipeline MUST fail without writing output.
"""
from __future__ import annotations
import argparse,csv,gzip,json,re
from collections import Counter
from datetime import datetime,timezone
from pathlib import Path

def series_from_shards(source_dir:Path):
    old_open,old_close=Counter(),Counter()
    fixed_open,fixed_close=Counter(),Counter()
    old_missing=fixed_missing=read=active=0
    for i in range(10):
        p=source_dir/f"shard-{i}.csv.gz"
        if not p.is_file():raise RuntimeError(f"Missing municipal shard {i}")
        with gzip.open(p,"rt",encoding="utf-8",newline="") as stream:
            for row in csv.reader(stream):
                if len(row)!=9:raise RuntimeError(f"Unexpected 9-column schema {i}")
                if len(row[0])!=14 or len(row[1])!=8:raise RuntimeError("Malformed establishment key")
                read+=1
                status=row[3].strip()
                if status=="02":active+=1
                wrong_open=row[4].strip()    # Old shard column 4 <- RFB row[6] DATA_SITUACAO
                wrong_close=row[5].strip()   # Old shard column 5 <- RFB row[10] DATA_INICIO
                for item in (wrong_open,wrong_close):
                    if item and not re.fullmatch(r"20\d{2}-\d{2}-\d{2}",item):
                        raise RuntimeError(f"Invalid shard date {item!r}")
                if wrong_open:old_open[wrong_open[:7]]+=1
                else:old_missing+=1
                if status=="08" and wrong_close:old_close[wrong_close[:7]]+=1
                if wrong_close:fixed_open[wrong_close[:7]]+=1
                else:fixed_missing+=1
                if status=="08" and wrong_open:fixed_close[wrong_open[:7]]+=1
    return {
       "records":read,"active":active,
       "old":{"open":old_open,"closed":old_close,"missing":old_missing},
       "corrected":{"open":fixed_open,"closed":fixed_close,"missing":fixed_missing}}

def metrics(openings,closings,reference):
    year=reference[:4]
    return {"openMonth":openings[reference],
            "openYear":sum(v for key,v in openings.items() if key.startswith(year)),
            "closedYearLatestSituation":sum(v for key,v in closings.items() if key.startswith(year)),
            "balanceYearProxy":sum(v for key,v in openings.items() if key.startswith(year))
                                  -sum(v for key,v in closings.items() if key.startswith(year))}

def monthly(openings,closings,reference):
    return [{"month":k,"openings":openings.get(k,0),"closingsLatestSituation":closings.get(k,0)}
            for k in sorted(set(openings)|set(closings)) if "2021-01"<=k<=reference]

def reconcile(source_dir:Path,input_path:Path,source_run_id:str):
    published=json.loads(input_path.read_text(encoding="utf-8"))
    if published.get("coverage",{}).get("dateFieldOrderVerified") is True:
        print("ALREADY_VERIFIED",published["reference"],flush=True)
        return False
    reference=published.get("reference")
    if published.get("status")!="official" or not re.fullmatch(r"20\d{2}-(0[1-9]|1[0-2])",str(reference)):
        raise RuntimeError("No official reference date")
    shard=series_from_shards(source_dir)
    if shard["records"]!=published["kpis"]["total"] or shard["active"]!=published["kpis"]["active"]:
        raise RuntimeError("Shard totals differ from published CNPJ snapshot")
    old=shard["old"]
    expected_old=metrics(old["open"],old["closed"],reference)
    if any(published["kpis"].get(key)!=val for key,val in expected_old.items()):
        raise RuntimeError(f"Existing metrics cannot be reconstructed from old shard order: {expected_old}")
    if monthly(old["open"],old["closed"],reference)!=published["monthly"]:
        raise RuntimeError("Full old month-by-month series differs: possible provenance mismatch")
    if old["missing"]!=published["coverage"].get("missingStartDates"):
        raise RuntimeError("Old missing-date counter does not match published snapshot")
    corrected=shard["corrected"]
    new=metrics(corrected["open"],corrected["closed"],reference)
    if new==expected_old:
        raise RuntimeError("Old and corrected date metrics unexpectedly identical")
    updated=json.loads(json.dumps(published))
    updated["kpis"].update(new)
    updated["monthly"]=monthly(corrected["open"],corrected["closed"],reference)
    updated["coverage"]["missingStartDates"]=corrected["missing"]
    updated["coverage"]["dateFieldOrderVerified"]=True
    updated["coverage"]["dateReconciliation"]={
      "method":"Recompute from 10 original 9-column RFB municipal CSV.gz fragments; pre-correction complete-series equality required",
      "sourceWorkflowRunId":source_run_id,
      "status":"reconciled",
      "verifiedAt":datetime.now(timezone.utc).isoformat(),
      "correctOpeningColumn":"RFB Estabelecimentos source index 10; original archive CSV column 5",
      "correctSituationColumn":"RFB Estabelecimentos source index 6; original archive CSV column 4"}
    updated["quality"]["notes"].append(
      "Indicadores de abertura e situação foram recalculados dos 10 fragmentos municipais originais após auditoria exata dos indicadores e de todos os meses antigos. "+
      "Data início da atividade RFB coluna 10, data da situação cadastral coluna 6. Não representa variação mensal de estoque entre fotografias.")
    target=input_path.with_suffix(".datefix.tmp")
    target.write_text(json.dumps(updated,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    if json.loads(target.read_text())["coverage"]["dateFieldOrderVerified"] is not True:
        raise RuntimeError("Failed to persist date audit")
    target.replace(input_path)
    print("CNPJ_DATE_CORRECTED",reference,"old",expected_old,"new",new,
      "missingStart",corrected["missing"],"monthly",len(updated["monthly"]),flush=True)
    return True

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--source-dir",type=Path,required=True)
    p.add_argument("--file",type=Path,default=Path("public/data/cnpj.json"))
    p.add_argument("--run-id",required=True)
    x=p.parse_args()
    reconcile(x.source_dir,x.file,x.run_id)
