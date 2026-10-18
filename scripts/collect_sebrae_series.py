#!/usr/bin/env python3
"""Public Sebrae Tesseract OLAP → auditable municipal time-series snapshots.

Fetches public anonymous published aggregations only. No authenticated API,
reverse-engineered tokens, private raw records, PII, or implicit cross-metric sum.
Validates the official 4304606 municipal filter and the RAIS 2025 reference.
A failure never silently turns a previous time series into an empty dataset.
"""
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime,timezone
from pathlib import Path
import argparse, json, math, os, re, sys, time, urllib.parse, urllib.request, urllib.error

ROOT=Path(__file__).resolve().parents[1]
CONFIG=ROOT/"scripts/sebrae_series_specs.json"
OUTPUT=ROOT/"public/data/sebrae-series.json"
BASE="https://apiv2-observatorio.sebrae.com.br/tesseract"
MUNICIPIO="4304606"
MAX_ROWS=9000
MAX_DATA_BYTES=5_000_000
COUNT_NAMES={"Workers","Establishments","Admissions","Resignations","Dismissed",
 "Enrollments","Teachers","Classes","Population","Herd Numbers",
 "Clients PJ Atendidos","Clientes PJ","Attendances","Students"}
META_IGNORE={"Region Sebrae","Municipality Sebrae","Journeys","Geography","Industry"}

def request(path,params=None,timeout=24):
    query=urllib.parse.urlencode(params,quote_via=urllib.parse.quote) if params else ""
    url=BASE+path+("?"+query if query else "")
    if not url.startswith(BASE+"/"):raise ValueError("URL outside public Sebrae OLAP")
    error=None
    for attempt in range(2):
        try:
            req=urllib.request.Request(url,headers={
                "User-Agent":"Mozilla/5.0 (compatible; CanoasEmpreende-municipal-public/1.0)",
                "Accept":"application/json","Accept-Encoding":"identity",
            })
            with urllib.request.urlopen(req,timeout=timeout) as r:
                if r.status!=200:raise ValueError(f"HTTP {r.status}")
                data=r.read(MAX_DATA_BYTES+1)
                if len(data)>MAX_DATA_BYTES:raise ValueError("Payload >5MB; require chart partitioning")
                return json.loads(data)
        except (TimeoutError,urllib.error.URLError,ValueError,json.JSONDecodeError) as ex:
            error=ex
            if attempt==0:time.sleep(.5)
    raise RuntimeError(str(error)[:250])

def levelset(cube):
    return {lvl.get("name") for dim in cube.get("dimensions",[]) for hierarchy in dim.get("hierarchies",[]) for lvl in hierarchy.get("levels",[])}

def metadata():
    raw=request("/cubes",timeout=40)
    items=raw.get("cubes",[])
    if not isinstance(items,list) or len(items)<40:
        raise RuntimeError("Sebrae catalogue absent/incomplete")
    return {c["name"]:c for c in items}

def get_spec(spec,cubes):
    cube=cubes.get(spec["cube"])
    if not cube:
        return {"status":"unavailable","reason":"Cube not found in verified public metadata"}
    levels=levelset(cube)
    dim=spec["dimensions"]
    if "Municipality" not in levels:
        return {"status":"unavailable","reason":"Cube lacks municipality boundary"}
    if not all(d in levels for d in dim):
        return {"status":"unavailable","reason":"Unavailable dimensions: "+", ".join(x for x in dim if x not in levels)}
    measures_avail={m["name"] for m in cube.get("measures",[])}
    measures=spec["measures"] or list(measures_avail)[:3]
    if not measures or not all(x in measures_avail for x in measures):
        return {"status":"unavailable","reason":"Unavailable measures: "+", ".join(x for x in measures if x not in measures_avail)}
    for key in spec["filters"]:
        if key not in levels: return {"status":"unavailable","reason":f"Missing filter dimension {key}"}
    p={"cube":spec["cube"],"drilldowns":",".join(dim),"measures":",".join(measures),
       "Municipality":MUNICIPIO,"parents":"false","limit":str(MAX_ROWS)}
    p.update(spec["filters"])
    try:
        response=request("/data.jsonrecords",p,timeout=39)
        if not isinstance(response,dict):
            raise ValueError("Response not object")
        rows=response.get("data")
        if not isinstance(rows,list):
            raise ValueError("Data not a list")
        total=response.get("page",{}).get("total",len(rows))
        if isinstance(total,int) and total>MAX_ROWS:
            raise ValueError(f"Query has {total} rows; max {MAX_ROWS}, partitioning required")
        if len(rows)>MAX_ROWS:
            raise ValueError("Server ignored result limit")
        cols=set(response.get("columns",[]))
        if not set(dim+measures).issubset(cols) and rows:
            raise ValueError("Unexpected OLAP columns, check dimensions/measures")
        cleaned=[]
        suppressed=0
        for row in rows:
            if not isinstance(row,dict):raise ValueError("Row is not object")
            item={}
            for key in dim:
                value=row.get(key)
                if type(value) not in (str,int,float):
                    raise ValueError("Unusable public dimension "+key)
                item[key]=value
            available=0
            for m in measures:
                value=row.get(m)
                if value is None or value=="" or isinstance(value,bool):
                    item[m]=None
                    continue
                val=float(value)
                if not math.isfinite(val):
                    item[m]=None
                    continue
                if m in COUNT_NAMES and 0<val<5:
                    item[m]=None
                    suppressed+=1
                else:
                    item[m]=round(val,4)
                    available+=1
            if available:cleaned.append(item)
        if not cleaned:
            return {"status":"empty","reason":"No numeric municipal values returned; do not interpret as zero",
                    "measures":measures,"count":0}
        distinctYears=sorted({int(r["Year"]) for r in cleaned if "Year" in r and str(r["Year"]).isdigit()})
        return {
          "status":"ok","rows":cleaned,"rowCount":len(cleaned),
          "returnedCount":len(rows),"suppressedSmallCells":suppressed,
          "measures":measures,
          "dimensions":dim,
          "years":distinctYears,
          "annotations":{k:v for k,v in (cube.get("annotations") or {}).items()
                         if k in ("source_name","source_description","source_link","table")},
          "sourceUrl":BASE+"/data.jsonrecords?"+urllib.parse.urlencode(p,quote_via=urllib.parse.quote),
        }
    except Exception as ex:
        return {"status":"unavailable","reason":str(ex)[:280]}

def validate_reference(results):
    r=results.get("rais-trabalho-anual",{})
    if r.get("status")!="ok":
        raise RuntimeError("Mandatory RAIS active-worker series could not be verified")
    points=[x for x in r["rows"] if x.get("Year")==2025]
    if len(points)!=1 or abs(points[0].get("Workers",0)-95355)>0.001:
        raise RuntimeError(f"Active RAIS 2025 expected 95355, got {points}; check filters/methodology")
    print("VALIDATED_RAÍS_2025",points[0]["Workers"],flush=True)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--limit-specs",type=int,default=0,help="Probe first N specifications")
    parser.add_argument("--workers",type=int,default=5)
    args=parser.parse_args()
    configuration=json.loads(CONFIG.read_text(encoding="utf-8"))
    assert configuration["territory"]==MUNICIPIO and configuration["endpoint"]==BASE
    specs=configuration["specifications"][:args.limit_specs] if args.limit_specs else configuration["specifications"]
    cubes=metadata()
    previous={}
    if OUTPUT.exists():
        try:
            old=json.loads(OUTPUT.read_text(encoding="utf-8"))
            if old.get("municipalityIbgeCode")==MUNICIPIO and old.get("schemaVersion")==1:
                previous={d["id"]:d for d in old.get("datasets",[]) if d.get("status")=="ok"}
        except Exception: pass
    results={}
    with ThreadPoolExecutor(max_workers=max(1,min(6,args.workers))) as pool:
        futures={pool.submit(get_spec,s,cubes):s for s in specs}
        for future in as_completed(futures):
            spec=futures[future]
            try:result=future.result()
            except Exception as ex:result={"status":"unavailable","reason":repr(ex)[:200]}
            results[spec["id"]]=result
            print("OLAP",spec["id"],result["status"],result.get("rowCount",0),result.get("reason","")[:140],flush=True)
    if not args.limit_specs:
        validate_reference(results)
    output=[]
    now=datetime.now(timezone.utc).isoformat()
    preserved=0
    for spec in specs:
        r=results[spec["id"]]
        if r["status"] in ("unavailable","empty") and spec["id"] in previous:
            old=previous[spec["id"]]
            old["stale"]=True
            old["latestError"]=r.get("reason","Not available")
            output.append(old)
            preserved+=1
        else:
            output.append({"id":spec["id"],"title":spec["title"],"topic":spec["topic"],
             "cube":spec["cube"],"dimensions":spec["dimensions"],
             "filters":spec["filters"],"requestedMeasures":spec["measures"],
             "notes":spec.get("notes",""),"unit":spec.get("unit",""),
             "lastSuccessAt":now if r["status"]=="ok" else None,
             "stale":False,**r})
    catalog=[]
    for cube in cubes.values():
        source=cube.get("annotations") or {}
        catalog.append({"name":cube["name"],"caption":cube.get("caption") or cube["name"],
          "source":source.get("source_name",""),
          "dimensions":sorted(levelset(cube)),
          "measures":[m["name"] for m in cube.get("measures",[])],
          "hasMunicipality":"Municipality" in levelset(cube)})
    catalog.sort(key=lambda x:x["name"].lower())
    ok=[d for d in output if d["status"]=="ok"]
    data={
      "schemaVersion":1,"status":"ok" if len(ok)>=18 else "partial",
      "municipality":"Canoas","municipalityIbgeCode":MUNICIPIO,
      "sourceUrl":"https://observatorio.sebrae.com.br/profile/geo/canoas",
      "apiUrl":BASE,
      "generatedAt":now,
      "datasets":output,"catalog":catalog,
      "coverage":{"specifications":len(specs),"available":len(ok),"unavailable":len(specs)-len(ok),
         "preservedFromPrevious":preserved,"catalogCubes":len(catalog),
         "rows":sum(len(d.get("rows",[])) for d in ok)},
      "methodology":[
       "Consultas públicas OLAP em https://apiv2-observatorio.sebrae.com.br/tesseract, filtradas estritamente por Municipality=4304606.",
       "RAIS_workers restringe Active worker indicator=1; 2025 validado contra 95.355 vínculos ativos divulgados pelo Sebrae.",
       "CAGED é fluxo de admissões e desligamentos; não é o estoque anual RAIS.",
       "Médias, taxas e índices não são somáveis entre categorias; selecione o subgrupo antes de comparar.",
       "Resultados com menos de cinco observações em medidas de contagem são suprimidos, nunca substituídos por zero.",
       "Um dataset indisponível não é considerado zero; fotografia previamente verificada é preservada e marcada stale.",
       "O catálogo lista cubos e dimensões públicas; um cubo catalogado não significa que todas suas combinações já foram extraídas.",
       "RF, Sebrae e a carga própria da Receita Federal podem divergir por recorte, filtro e data de extração.",
       "A série de VAB setorial antigo pode terminar em 2021, com ruptura no PIB municipal 2022–2023.",
       "Comércio exterior: domicílio fiscal do exportador/importador, não localização física da produção.",
       "Reprodução original do Canoas Empreende: visualizações próprias de dados agregados, não reutilização de imagens ou software do Sebrae.",
      ],
    }
    if args.limit_specs:
        print("PROBE_ONLY",json.dumps(data["coverage"],ensure_ascii=False),flush=True)
        return
    if len(ok)<12 or data["coverage"]["rows"]<70:
        raise RuntimeError(f"Insufficient verified coverage {data['coverage']}; leaving previous published data untouched")
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    tmp=OUTPUT.with_suffix(".tmp")
    tmp.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    tmp.replace(OUTPUT)
    print("PUBLIC_SERIES",json.dumps(data["coverage"],ensure_ascii=False),flush=True)

if __name__=="__main__":
    try:main()
    except Exception as exc:
        print("OLAP_FATAL",repr(exc),file=sys.stderr,flush=True)
        raise
