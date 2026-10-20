#!/usr/bin/env python3
"""Reproducible official 2022 Census sector collection for Canoas (IBGE 4304606).

No user-time external calls: download official RS polygons and BR aggregate ZIPs
during ETL; retain *only* the Canoas sectors as local JSON, GeoJSON and PMTiles.
Authoritative variable labels come from IBGE XLSX dictionaries.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import os
import tempfile
import urllib.request
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
import subprocess

import shapefile
import openpyxl
from pyproj import Transformer
from shapely.geometry import shape, mapping, Point
from shapely.ops import transform
from shapely.validation import make_valid

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"
MUNICIPALITY = "4304606"
BASE = "https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios"
ZIP_SHP = BASE + "/malha_com_atributos/setores/shp/UF/RS/RS_setores_CD2022.zip"
AGG = BASE + "/Agregados_por_Setor_csv/"
SOURCES = {
    "basico": AGG + "Agregados_por_setores_basico_BR_20260520.zip",
    "demografia": AGG + "Agregados_por_setores_demografia_BR.zip",
    "domicilio": AGG + "Agregados_por_setores_caracteristicas_domicilio1_BR.zip",
    "renda": "https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios_Rendimento_do_Responsavel/Agregados_por_setores_renda_responsavel_BR_20260508_csv.zip",
}
DICTIONARIES = {
    "geral": BASE + "/dicionario_de_dados_agregados_por_setores_censitarios_20260520.xlsx",
    "renda": "https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios_Rendimento_do_Responsavel/dicionario_de_dados_renda_responsavel_20260508.xlsx",
}
# Published census-coded variables, checked against the official XLSX before use.
SELECTED = {
    "basico": {
        "pop":"V0001", "dom_total":"V0002", "dom_part":"V0003",
        "dom_coletivos":"V0004", "moradores_media":"V0005",
        "imputados_pct":"V0006", "dom_ocupados":"V0007",
        "dom_ocasional":"V0008", "dom_vagos":"V0009",
    },
    "demografia": {
        "pessoas_sexo":"V01006", "masculino":"V01007", "feminino":"V01008",
        # Age/sex counts are kept separately, always under the exact
        # authoritative description; do not invent broad age bands.
        **{"demo_"+str(i):f"V{i:05d}" for i in range(1009,1042)}
    },
    "domicilio": {
        "dp_permanentes":"V00001", "dp_improvisados":"V00002",
        "dp_1morador":"V00017", "dp_2moradores":"V00018",
        "dp_3moradores":"V00019", "dp_4moradores":"V00020",
        "dp_5moradores":"V00021", "dp_6moradores":"V00022",
        "dp_criancas_0a9":"V00008",
        # Other attributes remain accessible by their official XLSX labels.
        **{"dom_"+str(i):"V"+str(i).zfill(5) for i in range(23,90)}
    },
    "renda": {
        "responsaveis":"V06001","residentes_dp":"V06002",
        "renda_media":"V06004","renda_mediana":"V06006",
    }
}
FIELDS = {k:code for group in SELECTED.values() for k,code in group.items()}
TRANSFORM = Transformer.from_crs("EPSG:4674", "EPSG:31982", always_xy=True)
INV = Transformer.from_crs("EPSG:31982", "EPSG:4326", always_xy=True)
MISSING = {"","X","x",".","-","..","...","N/A","NA"}
META_UNITS = {
    "moradores_media":"moradores/domicílio",
    "imputados_pct":"%",
    "renda_media":"R$ nominais/mês (2022)",
    "renda_mediana":"R$ nominais/mês (2022)",
}
RENAMED = {
    "pop":"População residente","dom_total":"Domicílios recenseados",
    "dom_ocupados":"Domicílios particulares ocupados",
    "dom_vagos":"Domicílios particulares permanentes vagos",
    "dom_ocasional":"Domicílios de uso ocasional",
    "moradores_media":"Média de moradores por domicílio ocupado",
    "imputados_pct":"Domicílios ocupados imputados",
    "masculino":"Homens","feminino":"Mulheres",
    "renda_media":"Rendimento nominal médio mensal do responsável com rendimento",
    "renda_mediana":"Rendimento nominal mediano mensal do responsável com rendimento",
}

def retrieve(url:str,max_bytes:int)->bytes:
    for retry in range(3):
        try:
            req=urllib.request.Request(url,headers={
                "User-Agent":"Mozilla/5.0 (Canoas GIS official census reproducibility)",
                "Accept":"*/*"})
            with urllib.request.urlopen(req,timeout=120) as response:
                if response.status!=200:raise ValueError(f"IBGE HTTP {response.status}")
                data=response.read(max_bytes+1)
            if len(data)>max_bytes or len(data)<1024:raise ValueError("IBGE download not within size envelope")
            return data
        except Exception:
            if retry==2:raise
    raise RuntimeError("Download failed")

def value(raw:str|None)->int|float|None:
    s=str(raw or "").strip()
    if s in MISSING:return None
    s=s.replace(",",".")
    try:n=float(s)
    except ValueError:return None
    if not math.isfinite(n) or n<0:return None
    return int(n) if n.is_integer() else round(n,5)

def labels()->dict[str,str]:
    ret={}
    for category,url in DICTIONARIES.items():
        raw=retrieve(url,3_000_000)
        wb=openpyxl.load_workbook(io.BytesIO(raw),read_only=True,data_only=True)
        for sheet in wb:
            for row in sheet.values:
                parts=[str(c or "").strip() for c in row]
                if category=="renda":
                    if len(parts)>=3 and parts[1].upper().startswith("V") and parts[1][1:].isdigit():
                        ret[parts[1].upper()]=parts[2]
                elif sheet.title=="Dicionário Básico":
                    if len(parts)>=3 and parts[1].upper().startswith("V"):
                        ret["basic:"+parts[1].upper()]=parts[2]
                elif sheet.title=="Dicionário não PCT":
                    if len(parts)>=4 and parts[2].upper().startswith("V"):
                        ret[parts[2].upper()]=parts[3]
    for group,fields in SELECTED.items():
        for alias,code in fields.items():
            key="basic:"+code if group=="basico" else code
            if key not in ret:
                raise ValueError(f"IBGE XLSX dictionary has no description for {group}/{code} ({alias})")
    return ret

def table(blob:bytes,selected:dict[str,str],target_ids:set[str],dataset:str)->dict[str,dict]:
    out={}
    z=zipfile.ZipFile(io.BytesIO(blob))
    csv_members=[item for item in z.infolist() if item.filename.lower().endswith(".csv") and not item.is_dir()]
    if len(csv_members)!=1:raise ValueError("Source should contain one CSV "+dataset)
    entry=csv_members[0]
    if entry.file_size>1_000_000_000:raise ValueError("Unexpected decompressed aggregate size")
    # Official CSV is Latin-1/Windows-1252, ';' separators, "X" = withheld.
    with z.open(entry) as binary:
        stream=io.TextIOWrapper(binary,encoding="latin-1",newline="")
        reader=csv.DictReader(stream,delimiter=";")
        headers={h.upper():h for h in (reader.fieldnames or [])}
        if "CD_SETOR" not in headers:raise ValueError("Missing CD_SETOR "+dataset)
        missing=[v for v in selected.values() if v.upper() not in headers]
        if missing:raise ValueError(f"Missing {dataset} columns: {missing}")
        for raw in reader:
            sid=raw[headers["CD_SETOR"]].strip()
            if sid not in target_ids:continue
            if sid in out:raise ValueError("Duplicate census sector "+sid+" in "+dataset)
            out[sid]={alias:value(raw[headers[code.upper()]]) for alias,code in selected.items()}
    if len(out)<max(100,int(len(target_ids)*.7)):
        raise ValueError(f"Low coverage {dataset}: {len(out)}/{len(target_ids)}")
    print("TABLE",dataset,"rows",len(out),"columns",len(selected),flush=True)
    return out

def polygons(blob:bytes,work:Path):
    z=zipfile.ZipFile(io.BytesIO(blob))
    for entry in z.infolist():
        if entry.filename.startswith("/") or ".." in entry.filename:raise ValueError("Unsafe archive name")
        if entry.file_size>100_000_000:raise ValueError("Oversized RS shapefile member")
        if entry.filename.lower().endswith((".shp",".shx",".dbf",".prj",".cpg")):
            (work/Path(entry.filename).name).write_bytes(z.read(entry))
    shp=work/"RS_setores_CD2022.shp"
    reader=shapefile.Reader(str(shp),encoding="utf-8")
    keys=[item[0] for item in reader.fields[1:]]
    if not {"CD_SETOR","CD_MUN","NM_MUN","CD_SIT"}.issubset(keys):
        raise ValueError("Unexpected official RS sector schema "+str(keys))
    selected={}
    for idx,record in enumerate(reader.iterRecords()):
        props=dict(zip(keys,record))
        if str(props.get("CD_MUN"))!=MUNICIPALITY:continue
        sid=str(props.get("CD_SETOR"))
        if len(sid)!=15 or sid in selected:raise ValueError("Invalid/duplicate sector ID "+sid)
        selected[sid]=(idx,props)
    if not 300<=len(selected)<=3500:raise ValueError(f"Unexpected Canoas sector count {len(selected)}")
    geom={}
    for sid,(idx,props) in selected.items():
        raw=shape(reader.shape(idx).__geo_interface__)
        if not raw.is_valid:raw=make_valid(raw)
        if raw.is_empty or raw.geom_type not in ("Polygon","MultiPolygon"):
            raise ValueError("Invalid sector topology "+sid)
        if not (-51.6<raw.representative_point().x<-50.7 and -30.2<raw.representative_point().y<-29.6):
            raise ValueError("Sector outside Canoas bounding box")
        projected=transform(TRANSFORM.transform,raw)
        if projected.area<10:raise ValueError("Invalid sector area "+sid)
        geom[sid]=(raw,projected,props)
    reader.close()
    print("SECTORS_GEOMETRY",len(geom),flush=True)
    return geom

def pct(a,b):
    return round(100*a/b,2) if a is not None and b is not None and b>0 else None

def rate(a,b):
    return round(a/b,3) if a is not None and b is not None and b>0 else None

def feature_data(geom,records):
    fields=[]
    for sid,(raw,projected,props) in geom.items():
        item=records[sid]
        area=round(projected.area/1_000_000,6)
        if area<.000001:raise ValueError("Invalid projected area")
        p=item.get("pop")
        if p is None and item.get("pessoas_sexo") is not None:
            raise ValueError("Incomplete basic dataset for sector "+sid)
        if item.get("masculino") is not None and item.get("feminino") is not None and p is not None:
            if abs(item["masculino"]+item["feminino"]-p)>5:
                raise ValueError("Gender count not conserved "+sid)
        item["dens_pop"]=rate(p,area)
        item["dens_dom"]=rate(item.get("dom_ocupados"),area)
        item["perc_mulheres"]=pct(item.get("feminino"),p)
        item["perc_vagos"]=pct(item.get("dom_vagos"),item.get("dom_part"))
        item["perc_ocupados"]=pct(item.get("dom_ocupados"),item.get("dom_part"))
        item["area_km2"]=area
        fields.append((sid,raw,projected,props,item))
    return fields

def write_geometry(fields):
    tiles=[]
    for sid,geo,projected,props,metrics in fields:
        simplified=transform(INV.transform,projected.simplify(2.3,preserve_topology=True))
        if simplified.is_empty:raise RuntimeError("Invalid simplified geometry")
        properties={"id":sid,"urban":str(props.get("CD_SIT"))=="1",
            "bairro_ibge":str(props.get("NM_BAIRRO") or ""),
            "area_km2":metrics["area_km2"]}
        properties.update({k:v for k,v in metrics.items() if v is not None})
        tiles.append({"type":"Feature","id":sid,"properties":properties,"geometry":mapping(simplified)})
    fc={"type":"FeatureCollection","name":"Canoas IBGE setores 2022",
        "crs":{"type":"name","properties":{"name":"urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features":tiles}
    path=DATA/"censo2022-setores.geojson"
    path.write_text(json.dumps(fc,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    output=DATA/"censo2022-setores.pmtiles"
    command=["tippecanoe","-f","-Z","9","-z","16","-l","setores",
        "--no-tile-size-limit","--no-feature-limit","--no-line-simplification",
        "-o",str(output),str(path)]
    subprocess.run(command,check=True,timeout=200,stdout=subprocess.DEVNULL)
    data=output.read_bytes()
    if data[:8]!=b"PMTiles\x03" or not 1_000<len(data)<30_000_000:
        raise ValueError("Generated census PMTiles invalid/too large")
    return {"path":"/data/censo2022-setores.pmtiles","layers":["setores"],
        "bytes":len(data),"sha256":hashlib.sha256(data).hexdigest(),
        "sourceGeometryPath":"/data/censo2022-setores.geojson"}

def official_neighborhoods(fields):
    geo=json.loads((DATA/"bairros-oficiais.geojson").read_text(encoding="utf-8"))
    regions=[]
    for feat in geo["features"]:
        name=feat["properties"]["BAIRRO"]
        g=transform(TRANSFORM.transform,shape(feat["geometry"]))
        if not g.is_valid:g=make_valid(g)
        regions.append((name,g))
    if len(regions)!=18:raise ValueError("Expected 18 official bairros GeoCanoas")
    output=defaultdict(lambda:{"fullyContained":0,"crossBoundary":0,"fullyContainedPop":0,
                              "populationArealEstimate":0.0,"populationAreaAllocationUnknown":0.0,
                              "sectorPopulationReported":0,"sectorCount":0})
    overlap=[]
    for sid,geo,projected,props,m in fields:
        area=projected.area
        links=[]
        for name,g in regions:
            if not projected.intersects(g):continue
            overlap_area=projected.intersection(g).area
            if overlap_area<min(100,area*.00001):continue
            links.append((name,overlap_area/area))
        links.sort(key=lambda x:-x[1])
        # Use intersector area only to describe intersection coverage.
        # Population interpolation is an explicit model, NEVER measured.
        for name,share in links:
            rec=output[name]
            rec["sectorCount"]+=1
            if share>=.999:
                rec["fullyContained"]+=1
                if m.get("pop") is not None:rec["fullyContainedPop"]+=m["pop"]
            else:rec["crossBoundary"]+=1
            if m.get("pop") is not None:
                rec["sectorPopulationReported"]+=1
                rec["populationArealEstimate"]+=m["pop"]*share
                if share<.999:rec["populationAreaAllocationUnknown"]+=m["pop"]*share
        overlap.append({"id":sid,"officialBairroDominant":links[0][0] if links else None,
          "dominantAreaPercent":round(100*links[0][1],2) if links else 0,
          "bairrosIntersected":[{"name":n,"areaSharePct":round(fraction*100,2)} for n,fraction in links],
          "crossBoundary":any(part<.999 for _,part in links) or not links})
    for name,g in regions:
        rec=output[name]
        rec["areaKm2"]=round(g.area/1_000_000,4)
        rec["populationArealEstimate"]=round(rec["populationArealEstimate"])
        rec["populationAreaAllocationUnknown"]=round(rec["populationAreaAllocationUnknown"])
    return {"method":"Intersect geometry in EPSG:31982; no point relocation.",
        "areaAllocationIsModel":True,
        "warning":"As estimativas populacionais por bairro utilizam rateio uniforme POR ÁREA de setores sobrepostos. Não são dados observados nem substituem o Censo por bairro.",
        "neighborhoods":[{"bairro":name,**output[name]} for name,_ in regions],
        "sectors":overlap}

def code_catalog(dictionary,fields):
    catalog=[]
    for group,selection in SELECTED.items():
        for alias,code in selection.items():
            key="basic:"+code if group=="basico" else code
            label=RENAMED.get(alias,dictionary[key])
            catalog.append({"id":alias,"code":code,"group":group,"label":label[:235],
               "unit":META_UNITS.get(alias,"contagem"),
               "precision":2 if alias in {"moradores_media","imputados_pct","renda_media","renda_mediana"} else 0,
               "description":dictionary[key][:340]})
    for field,title,unit in [
        ("dens_pop","População por km²","pessoas/km²"),
        ("dens_dom","Domicílios particulares ocupados por km²","domicílios/km²"),
        ("perc_mulheres","Percentual da população feminina","%"),
        ("perc_vagos","Percentual de domicílios particulares permanentes vagos no total de particulares","%"),
        ("perc_ocupados","Percentual de domicílios particulares ocupados no total de particulares","%"),
    ]:
        catalog.insert(0,{"id":field,"code":"calculado","group":"indicadores",
                          "label":title,"unit":unit,"precision":2,
                          "description":"Indicador derivado de contagens publicadas, sem preenchimento de valores suprimidos."})
    counts={item["id"]:sum(1 for _,_,_,_,m in fields if m.get(item["id"]) is not None) for item in catalog}
    for item in catalog:item["sectorsWithData"]=counts[item["id"]]
    return [item for item in catalog if item["sectorsWithData"]>0]

def main():
    DATA.mkdir(parents=True,exist_ok=True)
    files={}
    sha={}
    with tempfile.TemporaryDirectory(prefix="censo-canoas-") as d:
        work=Path(d)
        for name,url in [("malha",ZIP_SHP),*SOURCES.items()]:
            print("DOWNLOAD",name,url,flush=True)
            limit=35_000_000 if name=="malha" else (170_000_000 if name=="alfabetizacao" else 40_000_000)
            blob=retrieve(url,limit)
            files[name]=blob
            sha[name]=hashlib.sha256(blob).hexdigest()
            print("SOURCE_OK",name,len(blob),sha[name][:14],flush=True)
        geom=polygons(files["malha"],work)
        ids=set(geom)
        merged={sid:{} for sid in ids}
        for name,fields in SELECTED.items():
            rows=table(files[name],fields,ids,name)
            for sid in ids:merged[sid].update(rows.get(sid,{key:None for key in fields}))
        # Population is released for all inhabited sectors; empty ones in the
        # spatial layer may have no statistical record, and must remain null.
        details=feature_data(geom,merged)
        official=official_neighborhoods(details)
        dicts=labels()
        catalog=code_catalog(dicts,details)
        pmtiles=write_geometry(details)
        counts={metric["id"]:metric["sectorsWithData"] for metric in catalog}
        totalpop=sum(m["pop"] for _,_,_,_,m in details if m.get("pop") is not None)
        if not 340_000<=totalpop<=355_000:raise ValueError(f"Municipal population failed plausibility check: {totalpop}")
        metadata={
            "schemaVersion":1,"status":"verified","territory":MUNICIPALITY,
            "municipality":"Canoas","referenceYear":2022,
            "generatedAt":datetime.now(timezone.utc).isoformat(),
            "sourceGeometry":ZIP_SHP,"sourceAggregates":SOURCES,
            "sourceDictionaries":DICTIONARIES,"sourceSha256":sha,
            "sectorCount":len(details),"populationSumReported":totalpop,
            "populationReferenceSource":"Censo Demográfico 2022 / IBGE, agregados por setores",
            "pmtiles":pmtiles,"dictionary":catalog,
            "coverage":{"sectors":len(details),"sectorsWithPopulation":counts.get("pop",0),
                        "sectorsWithIncome":counts.get("renda_media",0),
                        "metricsWithData":len(catalog)},
            "privacy":{"individualCoordinatesPublished":False,
                       "withheldValuesKeptNull":True,
                       "notSectorMicrodata":True},
            "methods":[
                "Malha vetorial definitiva 2022 por RS, filtrada estritamente pelo código municipal 4304606.",
                "Agregados por setores: Básico revisado 20/05/2026; Demografia e Domicílios 2024; rendimento 08/05/2026.",
                "Dicionário de variáveis IBGE validado; X e . são N/D, jamais 0.",
                "A área em km² é medida em SIRGAS 2000 / UTM 22S (EPSG:31982).",
                "Há setores sem população (inclusive não habitados), ausentes de tabelas: N/D não é zero.",
                "CNPJ por bairro é declaração cadastral; cruzamentos setoriais não atribuem CNPJ individuais a setores.",
                "População rateada por área no cruzamento com bairro é apenas modelo areal, não valor oficial de bairro.",
            ],
            "sectors":[{"id":sid,"bairroIbge":str(p.get("NM_BAIRRO") or ""),
                        "situacao":str(p.get("SITUACAO") or ""),
                        "centroid":[round(geo.representative_point().x,6),round(geo.representative_point().y,6)],
                        "metrics":m} for sid,geo,_,p,m in details],
        }
        (DATA/"censo2022-setores.json").write_text(
            json.dumps(metadata,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
        (DATA/"censo2022-setores-bairros.json").write_text(
            json.dumps({"schemaVersion":1,"status":"verified","territory":MUNICIPALITY,
              "referenceYear":2022,"modelled":True,**official},
              ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
        print("CENSO2022_CANONICAL_OK",len(details),"population",totalpop,
              "metrics",len(catalog),"pmtiles",pmtiles["bytes"],flush=True)

if __name__=="__main__":
    main()
