#!/usr/bin/env python3
"""GeoCanoas BAIRROSOFICIAL -> PMTiles + municipal CNPJ choropleths.

No address guesswork: joins only the 18 polygon labels using audited aliases.
Never fabricates points, spreads records across neighborhoods, or merges
suppressed CNAE cells as if they were comprehensive.
"""
from __future__ import annotations
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
import hashlib, json, math, re, subprocess, unicodedata
import urllib.parse, urllib.request

BASE = "https://geo.canoas.rs.gov.br/server/rest/services/BAIRROSOFICIAL/FeatureServer/0"
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public/data"
TEMP = ROOT / "work/bairros"
LAYER = "bairros"
# Explicit orthographic synonyms ONLY. Do not allocate villas and subdivisions
# to official neighborhoods based on substring or centroid guesses.
ALIASES = {
    "MATIAS VELHO": "MATHIAS VELHO",
    "SAO LUIZ": "SAO LUIS",
    "MAL RONDON": "MARECHAL RONDON",
    "MAL. RONDON": "MARECHAL RONDON",
    "NSA SRA DAS GRACAS": "NOSSA SENHORA DAS GRACAS",
    "NOSSA SRA DAS GRACAS": "NOSSA SENHORA DAS GRACAS",
    "N SRA DAS GRACAS": "NOSSA SENHORA DAS GRACAS",
    "N S DAS GRACAS": "NOSSA SENHORA DAS GRACAS",
    "N. S. DAS GRACAS": "NOSSA SENHORA DAS GRACAS",
    "N. SRA. DAS GRACAS": "NOSSA SENHORA DAS GRACAS",
    "BAIRRO FATIMA": "FATIMA",
    "BAIRRO SAO JOSE": "SAO JOSE",
}
SECTIONS = "ABCDEFGHIJKLMNOPQRSTU"
LABELS = {
    "A":"Agropecuária", "B":"Indústrias extrativas", "C":"Indústrias de transformação",
    "D":"Eletricidade e gás", "E":"Água e saneamento", "F":"Construção",
    "G":"Comércio", "H":"Transporte", "I":"Alojamento e alimentação",
    "J":"Informação e comunicação", "K":"Finanças", "L":"Atividades imobiliárias",
    "M":"Profissionais e técnicas", "N":"Administrativas", "O":"Administração pública",
    "P":"Educação", "Q":"Saúde", "R":"Artes", "S":"Outros serviços", "T":"Serviços domésticos",
    "U":"Organizações extraterritoriais",
}

def norm(value: str) -> str:
    s = unicodedata.normalize("NFKD", str(value or "").upper().strip())
    return re.sub(r"\s+", " ", "".join(c for c in s if not unicodedata.combining(c))).strip()

def canonical(value: str, officials: set[str]) -> str | None:
    key = norm(value)
    key = ALIASES.get(key, key)
    return key if key in officials else None

def json_query(params: dict, max_bytes=40_000_000) -> dict:
    url = BASE + "/query?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Accept":"application/json", "User-Agent":"CanoasEmpreende-geoprocessing/1.0"})
    with urllib.request.urlopen(req, timeout=90) as r:
        if r.status != 200: raise RuntimeError(f"ArcGIS REST HTTP {r.status}")
        blob = r.read(max_bytes+1)
        if len(blob) > max_bytes: raise RuntimeError("ArcGIS response too large")
    data = json.loads(blob)
    if not isinstance(data, dict) or data.get("error"): raise RuntimeError(f"ArcGIS REST response invalid: {str(data.get('error'))[:300]}")
    return data

def safe_number(x):
    if isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x):
        return float(x)
    return None

def cleanup_z(coords):
    if isinstance(coords,list) and coords and isinstance(coords[0], (float,int)):
        if len(coords)<2:raise ValueError("Bad coordinate")
        lon,lat=float(coords[0]),float(coords[1])
        if not (-51.55 < lon < -50.9 and -30.15 < lat < -29.65):
            raise ValueError("Geometry outside Canoas expected extent")
        return [lon,lat]
    if not isinstance(coords,list): raise ValueError("Bad coordinate tree")
    return [cleanup_z(x) for x in coords]

def validate_archive(file: Path):
    if not file.exists() or file.stat().st_size < 130:raise RuntimeError("PMTiles missing or too small")
    if file.open("rb").read(8) != b"PMTiles\x03":raise RuntimeError("PMTiles v3 magic/version mismatch")
    if file.stat().st_size>60_000_000:raise RuntimeError("PMTiles too large for GitHub-hosted municipal prototype")

def main():
    cnpj=json.loads((DATA/"cnpj.json").read_text(encoding="utf-8"))
    if cnpj.get("status")!="official" or cnpj.get("municipalityIbgeCode")!="4304606":
        raise RuntimeError("No validated official Canoas CNPJ snapshot")
    reference=cnpj.get("reference")
    if not re.fullmatch(r"20\d\d-(0[1-9]|1[0-2])",str(reference)):
        raise RuntimeError("CNPJ reference missing/invalid")
    active=int(cnpj["kpis"]["active"])
    declared=cnpj["byDistrictDeclared"]
    sectors=cnpj["districtSectorCells"]
    if not 0 < sum(x["count"] for x in declared) <= active:raise RuntimeError("Bad active district aggregates")
    # Validate polygon layers and avoid partial pagination.
    count=json_query({"where":"1=1","returnCountOnly":"true","f":"json"}).get("count")
    if count != 18: raise RuntimeError(f"Unexpected official neighborhood feature count {count}; review boundary version")
    attrs=json_query({"where":"1=1","outFields":"OBJECTID_1,BAIRRO,POPULACAO_2022,DOMICILIOS","returnGeometry":"false","f":"json"})
    polygons=json_query({"where":"1=1","outFields":"OBJECTID_1,BAIRRO","returnGeometry":"true","outSR":"4326","f":"geojson"})
    records=attrs.get("features")
    geometries=polygons.get("features")
    if len(records)!=18 or len(geometries)!=18:
        raise RuntimeError(f"Official geometry/attributes incomplete: {len(records)} vs {len(geometries)}")
    byid={}
    official_names=set()
    for record in records:
        obj=record["attributes"];oid=int(obj["OBJECTID_1"])
        name=str(obj["BAIRRO"]).strip()
        if not name or oid in byid or norm(name) in official_names:raise ValueError("Duplicate/missing official neighborhood")
        byid[oid]=obj
        official_names.add(norm(name))
    # Use the official object ID and visible label to reconcile attributes/geometry.
    geo_byid={}
    for row in geometries:
        rawid=row.get("id") or row.get("properties",{}).get("OBJECTID_1")
        oid=int(rawid)
        if oid not in byid or oid in geo_byid:raise ValueError("Geometry mismatch")
        geo_byid[oid]=row
    if set(byid)!=set(geo_byid):raise RuntimeError("Polygon IDs do not match attribute IDs")
    counts=defaultdict(int);sector_counts=defaultdict(lambda:defaultdict(int))
    unresolved=[]
    for entry in declared:
        value=int(entry["count"]); target=canonical(entry["name"],official_names)
        if target:counts[target]+=value
        else:unresolved.append({"name":entry["name"],"count":value,"reason":"Sem correspondência oficial auditada"})
    for entry in sectors:
        value=int(entry["count"]); target=canonical(entry["district"],official_names)
        sec=str(entry["sector"])
        if target and sec in SECTIONS and value>=5:
            sector_counts[target][sec]+=value
    # Compute actual areas from official polygons in 31982, not from the WGS84 degree².
    from shapely.geometry import shape, mapping
    from shapely.ops import transform
    from pyproj import Transformer
    transform_to_m = Transformer.from_crs("EPSG:4326","EPSG:31982",always_xy=True).transform
    work=[];rows=[];area_total=0.0;total_pop=0
    for oid,raw in sorted(byid.items(),key=lambda x:norm(x[1]["BAIRRO"])):
        name=raw["BAIRRO"];key=norm(name)
        geom=geo_byid[oid]["geometry"]
        if geom.get("type") not in ("Polygon","MultiPolygon"):raise ValueError(f"Invalid polygon type {name}")
        geom={"type":geom["type"],"coordinates":cleanup_z(geom["coordinates"])}
        shp=shape(geom)
        if not shp.is_valid:shp=shp.buffer(0)
        if shp.is_empty or shp.geom_type not in ("Polygon","MultiPolygon"):raise ValueError(f"Invalid repaired polygon {name}")
        area=transform(transform_to_m,shp).area/1_000_000
        if not .001<area<100:raise ValueError(f"Unexpected area {name}:{area}")
        area_total+=area
        population=safe_number(raw.get("POPULACAO_2022"))
        if population is not None:total_pop+=int(population)
        population=int(population) if population is not None else None
        known=counts.get(key)
        active_count=known if known and known>=5 else None
        density=round(active_count/area,2) if active_count is not None else None
        perpop=round(active_count*1000/population,2) if active_count is not None and population and population>0 else None
        props={"oid":oid,"bairro":name,"active":active_count,"area_km2":round(area,4),
            "pop2022":population,"per_km2":density,"per_1000":perpop}
        for sec in SECTIONS:
            n=sector_counts[key].get(sec)
            if n:
                props["s"+sec]=n
                props["d"+sec]=round(n/area,2)
                if population and population>0: props["p"+sec]=round(n*1000/population,2)
        work.append({"type":"Feature","id":oid,"properties":props,"geometry":mapping(shp)})
        rows.append({"id":oid,"name":name,"active":active_count,"areaKm2":round(area,4),
             "population2022":population,"densityKm2":density,"per1000Population":perpop,
             "sectorCounts":{sec:n for sec,n in sorted(sector_counts[key].items())}})
    if not (80<area_total<300):raise RuntimeError(f"Unrealistic total area {area_total}")
    matched=sum(counts.values())
    if matched>active or matched<active*.75:raise RuntimeError(f"Unacceptable CNPJ-name matches {matched}/{active}")
    unresolved_count=sum(r["count"] for r in unresolved)
    published_count=sum(r["count"] for r in declared)
    if matched+unresolved_count!=published_count:raise RuntimeError("Lost rows during alias matching")
    now=datetime.now(timezone.utc).isoformat()
    snapshot={"reference":reference,"generatedAt":now,"geometrySource":BASE,"sourceYearPopulation":2022,
      "neighborhoods":rows,"coverage":{"activeTotal":active,"declaredPublished":published_count,
      "matched":matched,"unmatchedPublished":unresolved_count,"notPublishedByThreshold":active-published_count,
      "matchedPercent":round(100*matched/active,3),"sectorCellsPublished":len(sectors)},
      "unmatched":sorted(unresolved,key=lambda item:-item["count"])}
    TEMP.mkdir(parents=True,exist_ok=True)
    DATA.mkdir(parents=True,exist_ok=True)
    gfile=TEMP/"bairros-ecovetorial.geojson"
    gfile.write_text(json.dumps({"type":"FeatureCollection","features":work},ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    tiles=DATA/"bairros-economia.pmtiles"
    subprocess.run(["tippecanoe","-f","-Z","9","-z","15","-l",LAYER,
       "--no-tile-size-limit","--no-feature-limit","-o",str(tiles),str(gfile)],
       check=True,timeout=160)
    validate_archive(tiles)
    # Persist the exact official polygon geometries as a reusable project asset.
    # The unversioned GeoCanoas REST service is NOT the browser's source of truth.
    reference_polygons={
      "type":"FeatureCollection",
      "metadata":{"source":BASE,"sridOriginal":31982,"sridGeoJSON":4326,
                  "retrievedAt":now,"featureCount":18,
                  "notes":"18 polygon features from the public BAIRROSOFICIAL layer; no company locations"},
      "features":[
        {"type":"Feature","id":row["id"],
         "properties":{"OBJECTID_1":row["id"],"BAIRRO":row["name"],
                       "POPULACAO_2022":row["population2022"],"AREA_KM2":row["areaKm2"]},
         "geometry":feature["geometry"]}
        for row,feature in zip(rows,work)
      ]
    }
    official_file=DATA/"bairros-oficiais.geojson"
    official_file.write_text(json.dumps(reference_polygons,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    sha=hashlib.sha256(tiles.read_bytes()).hexdigest()
    output={"schemaVersion":1,"status":"verified","reference":reference,"generatedAt":now,
       "territory":"4304606","sourceUrl":BASE,"sourceCnpj":"Receita Federal — CNPJ "+reference,
       "pmtiles":{"path":"/data/bairros-economia.pmtiles","layer":LAYER,"bytes":tiles.stat().st_size,"sha256":sha,
          "geometryCount":18,"crsSource":"EPSG:31982","crsTiles":"EPSG:4326"},
       "coverage":snapshot["coverage"],"population2022LayerSum":total_pop,
       "areaKm2OfficialPolygons":round(area_total,3),
       "neighborhoods":rows,"unmatched":snapshot["unmatched"],
       "sectors":[{"code":x,"label":LABELS[x]} for x in SECTIONS if any(x in r["sectorCounts"] for r in rows)],
       "notes":[
        "Estabelecimentos ativos (matrizes e filiais), do CNPJ Receita Federal; endereço/bairro declarado não foi geocodificado.",
        "Apenas correspondências por nome oficial normalizado e aliases explícitos auditados. Vilas e registros ambíguos não são atribuídos.",
        "O agregado original de bairros só publica os 50 maiores grupos com pelo menos cinco CNPJs: registros omitidos não são zeros.",
        "CNAE x bairro contém apenas células originalmente publicadas com pelo menos cinco registros; totais setoriais são limites inferiores.",
        "POPULACAO_2022 é o atributo da camada BAIRROSOFICIAL GeoCanoas, não necessariamente igual à contagem IBGE no painel municipal.",
        "Empresas por km² utilizam área em EPSG:31982; por 1.000 habitantes usa o dado GeoCanoas de 2022 (anos distintos).",
        "Nenhuma posição pontual foi produzida: os polígonos oficiais representam bairros, não localização precisa de empresas.",
        "Ausência de estabelecimentos classificados ou população zero resulta em N/D, nunca zero estimado.",
       ]}
    # Persist immutable references by monthly snapshot, do not silently overwrite
    # a previous archived count if the input reference is unchanged.
    store=DATA/"bairros-economia-series.json"
    history={"schemaVersion":1,"territory":"4304606","snapshots":[]}
    if store.exists():
        history=json.loads(store.read_text(encoding="utf-8"))
        if history.get("territory")!="4304606":raise RuntimeError("Archive territory mismatch")
    past=[s for s in history.get("snapshots",[]) if s.get("reference")!=reference]
    past.append(snapshot)
    past.sort(key=lambda s:s["reference"])
    history["snapshots"]=past
    # Both outputs only written after valid PMTiles exists.
    (DATA/"bairros-economia.json").write_text(json.dumps(output,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    store.write_text(json.dumps(history,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print("GEO_CANOAS_OK",json.dumps({"bairros":len(rows),"matched":matched,"active":active,
      "unmatched":unresolved_count,"populationSum":total_pop,"areaKm2":round(area_total,3),
      "pmtilesBytes":tiles.stat().st_size,"sha256":sha[:15],
      "snapshots":len(past)},ensure_ascii=False),flush=True)

if __name__=="__main__":
    main()
