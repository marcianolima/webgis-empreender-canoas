#!/usr/bin/env python3
"""Conservative municipal CNPJ-to-CNEFE (2022) address crosswalk.

The Receita raw ZIP is processed IN PLACE in shard jobs. Only aggregated
500 m hexagon counts are retained; no company number/name/address, CNEFE
unique ID, street coordinates, house number or CEP are persisted.
Matches require exact CEP, street type/name, number and CNEFE geolocation
quality 1/2 in a nonresidential address. Ambiguous matches are discarded.
"""
from __future__ import annotations
from collections import Counter,defaultdict
from datetime import datetime,timezone
from pathlib import Path
import csv,io,json,re,unicodedata,urllib.request,zipfile

from shapely.geometry import Point,shape
from shapely.ops import unary_union,transform
from shapely.prepared import prep
from pyproj import Transformer
from collect_hex500 import SOURCE,index_of,center

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"public/data"
WORK=ROOT/"work/cnpj"
TYPES={"AV":"AVENIDA","AV.":"AVENIDA","R":"RUA","R.":"RUA","TV":"TRAVESSA","TRAV":"TRAVESSA",
       "ESTR":"ESTRADA","ROD":"RODOVIA","PCA":"PRACA","PC":"PRACA","AL":"ALAMEDA"}

def normalize(s):
    chars=unicodedata.normalize("NFKD",str(s or "").strip().upper())
    return " ".join(re.findall(r"[A-Z0-9]+","".join(c for c in chars if not unicodedata.combining(c))))

def street(tipo,nome):
    tp=normalize(tipo)
    tp=TYPES.get(tp,tp)
    value=normalize(nome)
    if not tp or not value:return ""
    if value.startswith(tp+" "):value=value[len(tp)+1:]
    return tp+" "+value

def number(s):
    a=normalize(s)
    return str(int(a)) if a.isdigit() and len(a)<=6 else ""

def cep(s):
    n=re.sub("[^0-9]","",str(s or ""))
    return n if len(n)==8 else ""

def cnefe_index():
    source=DATA/"bairros-oficiais.geojson"
    polygons=json.loads(source.read_text(encoding="utf-8"))["features"]
    assert len(polygons)==18
    tr=Transformer.from_crs("EPSG:4326","EPSG:31982",always_xy=True)
    boundary=prep(unary_union([transform(tr.transform,shape(f["geometry"])) for f in polygons]))
    with urllib.request.urlopen(urllib.request.Request(SOURCE,headers={"User-Agent":"CanoasEmpreende/1.0"}),timeout=80) as res:
        blob=res.read(12_000_000)
    seen={}
    stats=Counter()
    with zipfile.ZipFile(io.BytesIO(blob)) as archive:
        with archive.open(archive.namelist()[0]) as data:
            rows=csv.DictReader(io.TextIOWrapper(data,encoding="utf-8-sig",newline=""),delimiter=";")
            for r in rows:
                if r["COD_MUNICIPIO"]!="4304606":raise RuntimeError("CNEFE municipality mismatch")
                if r["COD_ESPECIE"] not in ("3","4","5","6","8") or r["NV_GEO_COORD"] not in ("1","2"):
                    continue
                k=(cep(r["CEP"]),
                   street(r["NOM_TIPO_SEGLOGR"]," ".join(filter(None,[r["NOM_TITULO_SEGLOGR"],r["NOM_SEGLOGR"]]))),
                   number(r["NUM_ENDERECO"]))
                if not all(k):stats["cnefe_incomplete"]+=1;continue
                try:
                    x,y=tr.transform(float(r["LONGITUDE"]),float(r["LATITUDE"]))
                    if not boundary.covers(Point(x,y)):stats["cnefe_outside"]+=1;continue
                except (TypeError,ValueError):continue
                cell=index_of(x,y)
                # An address containing multiple buildings can be reconciled
                # only if all legitimate placements fall in the SAME hexagon.
                prior=seen.get(k)
                if prior=="AMBIGUOUS":continue
                if prior and prior!=cell:
                    seen[k]="AMBIGUOUS"
                    stats["ambiguous_addresses"]+=1
                else:
                    seen[k]=cell
                    stats["address_candidates"]+=1
    return seen,stats

def match_shard(reference,index,municipio,archive,csv_zip):
    cache,stats=cnefe_index()
    cells=Counter();sectors=Counter();active=matched=eligible=0
    # section categorization from the same official CNAE mapping as RFB pipeline
    from cnpj_pipeline import section
    for r in csv_zip(archive):
        if len(r)<21 or r[5].strip()!="02" or r[19].strip()!="RS" or r[20].strip()!=municipio:
            continue
        active+=1
        k=(cep(r[18]),street(r[13],r[14]),number(r[15]))
        if not all(k):continue
        eligible+=1
        cell=cache.get(k)
        if not cell or cell=="AMBIGUOUS":continue
        matched+=1
        code=f"h{cell[0]}_{cell[1]}"
        cells[code]+=1
        sec=section(r[11].strip())
        if sec in "ABCDEFGHIJKLMNOPQRSTU":
            sectors[(code,sec)]+=1
    WORK.mkdir(parents=True,exist_ok=True)
    output={"schemaVersion":1,"reference":reference,"shard":index,"source":"RFB+IBGE_CNEFE2022",
       "active":active,"hasUsableAddress":eligible,"matched":matched,
       "matchKeys":len(cache),"ambiguousKeys":sum(v=="AMBIGUOUS" for v in cache.values()),
       "cells":dict(cells),
       "sectors":[{"cell":c,"sector":sec,"count":v} for (c,sec),v in sorted(sectors.items())]}
    if active<200 or matched<10:raise RuntimeError(f"Insufficient deterministic address matches {index} {matched}/{active}")
    (WORK/f"geo-part-{index}.json").write_text(json.dumps(output,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print("CNPJ_CNEFE_MATCH_SHARD",index,"active",active,"exact",matched,"candidates",len(cache),flush=True)

def assemble(reference,path):
    bycell=Counter();bysector=Counter();active=matched=eligible=0
    for i in range(10):
        data=json.loads((path/f"geo-part-{i}.json").read_text(encoding="utf-8"))
        if data["reference"]!=reference or data["shard"]!=i or data["source"]!="RFB+IBGE_CNEFE2022":
            raise RuntimeError("Missing/inconsistent RFB spatial fragment")
        active+=data["active"];matched+=data["matched"];eligible+=data["hasUsableAddress"]
        for key,v in data["cells"].items():bycell[key]+=v
        for row in data["sectors"]:bysector[(row["cell"],row["sector"])]+=row["count"]
    cnpj=json.loads((DATA/"cnpj.json").read_text(encoding="utf-8"))
    if cnpj["reference"]!=reference or active!=cnpj["kpis"]["active"] or sum(bycell.values())!=matched:
        raise RuntimeError(f"Cannot reconcile exact matches against full municipal RFB snapshot: {active=} {matched=}")
    # Publish ONLY cells of at least five. Suppress category count and its
    # complement if either is 1..4; no address/point/CNPJ identifier persists.
    published=[]
    for cell,count in sorted(bycell.items()):
        if count<5:continue
        props={"cell":cell,"matched":count}
        for (s,sec),n in bysector.items():
            if s==cell and n>=5 and count-n>=5:props["s"+sec]=n
        published.append(props)
    output={"schemaVersion":1,"status":"verified",
      "reference":reference,"territory":"4304606","generatedAt":datetime.now(timezone.utc).isoformat(),
      "source":"Receita Federal + IBGE CNEFE Censo 2022",
      "method":"Correspondência exata: CEP, tipo/nome de logradouro, número; coordenadas CNEFE níveis 1 e 2; estabelecimentos não domiciliares (espécies 3,4,5,6,8). Coordenadas conflitantes excluídas.",
      "scope":"Subconjunto com endereçamento comprovadamente coincidente; NÃO é geocodificação completa do universo dos CNPJs ativos.",
      "privacy":{"individualCoordinatesPublished":False,"individualAddressesPublished":False,"minPublishedHexCount":5},
      "coverage":{"active":active,"hasUsableAddress":eligible,"matched":matched,
         "matchedPercent":round(100*matched/active,3),"cellsPublished":len(published),
         "matchedInPublishedCells":sum(x["matched"] for x in published)},
      "cells":published,
      "notes":["É um subconjunto de estabelecimentos ativos na fotografia RFB de "+reference+" associados a endereços não domiciliares do CNEFE 2022.",
       "O CNEFE de 2022 e a Receita de 2026 podem ter mudanças de endereço, número ou composição empresarial. Cruzamento exato não garante que o negócio opere no endereço.",
       "Estabelecimentos que usam endereços residenciais foram intencionalmente excluídos da correspondência publicada.",
       "Endereços e coordenadas individuais não são publicados; agregações territoriais apenas em hexágonos >=5."]}
    dst=DATA/"cnpj-geo-hex500.json"
    dst.write_text(json.dumps(output,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print("CNPJ_CNEFE_GEOCODED",json.dumps(output["coverage"],ensure_ascii=False),flush=True)

def main():
    import argparse
    p=argparse.ArgumentParser()
    p.add_argument("action",choices=["assemble"])
    p.add_argument("--reference",required=True)
    p.add_argument("--source-dir",type=Path,default=Path("work/shards"))
    args=p.parse_args()
    assemble(args.reference,args.source_dir)

if __name__=="__main__":main()
