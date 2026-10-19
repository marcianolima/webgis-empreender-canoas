#!/usr/bin/env python3
"""500 m hexagonal grid and spatial heat map, using only public IBGE CNEFE 2022.

This is a map of *observed nonresidential CNEFE address records*, NOT CNPJs.
The hexagon width (flat-to-flat) is exactly 500 m in EPSG:31982.
Full non-domestic addresses and raw coordinates are kept in-memory ONLY.
No centroids of neighborhoods are used as business points.
"""
from __future__ import annotations
from collections import Counter,defaultdict
from datetime import datetime,timezone
from pathlib import Path
import csv,hashlib,io,json,math,subprocess,urllib.request,zipfile

from shapely.geometry import Point,Polygon,shape,mapping
from shapely.ops import transform,unary_union
from shapely.prepared import prep
from pyproj import Transformer

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"public/data"
WORK=ROOT/"work/hex500"
SOURCE="https://ftp.ibge.gov.br/Cadastro_Nacional_de_Enderecos_para_Fins_Estatisticos/Censo_Demografico_2022/Arquivos_CNEFE/CSV/Municipio/43_RS/4304606_CANOAS.zip"
SCALE=500.
RADIUS=SCALE/math.sqrt(3)  # hexagon flat-to-flat=500m
DY=3*RADIUS/2
KINDS={"3":"Agropecuário","4":"Educação","5":"Saúde","6":"Outras finalidades","8":"Religioso"}
QUALITY={"1":"Coordenada original","2":"Coordenada ajustada","3":"Coordenada estimada",
         "4":"Face de quadra","5":"Localidade","6":"Setor censitário"}
MIN=5

def center(i,j):
    return (i*SCALE+(j%2)*SCALE/2,j*DY)

def hexagon(i,j):
    x,y=center(i,j)
    return Polygon([(x+RADIUS*math.cos(math.radians(a)),
                     y+RADIUS*math.sin(math.radians(a)))
                    for a in (30,90,150,210,270,330)])

def index_of(x,y):
    jj=round(y/DY)
    ii=round((x-(jj%2)*SCALE/2)/SCALE)
    # Voronoi cells of the triangular lattice form regular hexagons.
    candidates=[(i,j) for j in range(jj-2,jj+3) for i in range(ii-2,ii+3)]
    i,j=min(candidates,key=lambda ij:(center(*ij)[0]-x)**2+(center(*ij)[1]-y)**2)
    return (i,j)

def within(x,y,polygon):
    return polygon.covers(Point(x,y))

def safe_public(n):
    return n if n>=MIN else (0 if n==0 else None)

def extract():
    official=DATA/"bairros-oficiais.geojson"
    if not official.exists():
        raise RuntimeError("Official GeoCanoas polygons must be stored in repository first")
    raw=json.loads(official.read_text(encoding="utf-8"))
    feats=raw.get("features",[])
    if len(feats)!=18:raise RuntimeError("Incomplete official neighborhood geometry")
    project=Transformer.from_crs("EPSG:4326","EPSG:31982",always_xy=True)
    inv=Transformer.from_crs("EPSG:31982","EPSG:4326",always_xy=True)
    boundary=unary_union([transform(project.transform,shape(f["geometry"])) for f in feats])
    if boundary.is_empty or not boundary.is_valid:raise RuntimeError("Official geometry is invalid")
    prepared=prep(boundary)
    bounds=boundary.bounds
    if not (475000<bounds[0]<495000 and 6680000<bounds[1]<6700000):
        raise RuntimeError("Unexpected municipal extent")
    req=urllib.request.Request(SOURCE,headers={"User-Agent":"CanoasEmpreende IBGE public research/1.0"})
    with urllib.request.urlopen(req,timeout=90) as response:
        zbytes=response.read(15_000_001)
    if len(zbytes)>15_000_000:raise RuntimeError("CNEFE municipal input too large")
    sha=hashlib.sha256(zbytes).hexdigest()
    bycell=defaultdict(Counter)
    byquality=Counter()
    kinds=Counter()
    processed=selected=outside=bad=0
    with zipfile.ZipFile(io.BytesIO(zbytes)) as archive:
        members=[f for f in archive.infolist() if not f.is_dir()]
        if len(members)!=1 or members[0].file_size>80_000_000:
            raise RuntimeError("Unexpected CNEFE archive structure")
        with archive.open(members[0]) as stream:
            text=io.TextIOWrapper(stream,encoding="utf-8-sig",newline="")
            reader=csv.DictReader(text,delimiter=";")
            mandatory={"COD_MUNICIPIO","COD_ESPECIE","LATITUDE","LONGITUDE","NV_GEO_COORD"}
            if not mandatory.issubset(reader.fieldnames or []):
                raise RuntimeError("CNEFE header changed")
            for row in reader:
                processed+=1
                if row["COD_MUNICIPIO"]!="4304606":
                    raise RuntimeError("Source includes records outside Canoas")
                kind=row["COD_ESPECIE"].strip()
                if kind not in KINDS:continue
                level=row["NV_GEO_COORD"].strip()
                if level not in QUALITY:bad+=1;continue
                try:
                    lat=float(row["LATITUDE"].replace(",","."))
                    lon=float(row["LONGITUDE"].replace(",","."))
                    if not(-30.15<lat<-29.65 and -51.55<lon<-50.9):
                        bad+=1;continue
                    x,y=project.transform(lon,lat)
                    if not(prepared.covers(Point(x,y))):
                        outside+=1;continue
                except (ValueError,TypeError,OverflowError):
                    bad+=1;continue
                selected+=1
                key=index_of(x,y)
                bucket=bycell[key]
                bucket["total"]+=1
                bucket["kind_"+kind]+=1
                bucket["quality_"+level]+=1
                if level in ("1","2"):
                    bucket["high"]+=1
                    bucket["high_kind_"+kind]+=1
                else:bucket["approx"]+=1
                byquality[level]+=1
                kinds[kind]+=1
    if processed<20_000 or selected<2000 or len(bycell)<70:
        raise RuntimeError(f"CNEFE suspiciously incomplete: {processed=}, {selected=}, {len(bycell)=}")
    x0,y0,x1,y1=bounds
    imin=int(math.floor(x0/SCALE))-2;imax=int(math.ceil(x1/SCALE))+2
    jmin=int(math.floor(y0/DY))-2;jmax=int(math.ceil(y1/DY))+2
    hexes=[];heat=[];cells=[];totalcells=0
    hexjson=WORK/"hex500.geojson"
    heatjson=WORK/"heat500.geojson"
    for j in range(jmin,jmax+1):
        for i in range(imin,imax+1):
            hexshape=hexagon(i,j)
            if not hexshape.intersects(boundary):continue
            clip=hexshape.intersection(boundary)
            if clip.is_empty or clip.area<10:continue
            # Tiny slivers can have GeometryCollections after clipping.
            if clip.geom_type=="GeometryCollection":
                polys=[g for g in clip.geoms if g.geom_type in ("Polygon","MultiPolygon")]
                clip=unary_union(polys)
            if clip.geom_type not in ("Polygon","MultiPolygon") or clip.is_empty:continue
            totalcells+=1
            bucket=bycell[(i,j)]
            total=bucket["total"]
            high=bucket["high"]
            props={"cell":f"h{i}_{j}","n":safe_public(total),
                   "n_high":safe_public(high),
                   "a_km2":round(clip.area/1_000_000,5),
                   "q":"CNEFE2022"}
            if props["n"] is not None and props["a_km2"]>0:
                props["d_km2"]=round(total/(clip.area/1_000_000),1)
            # Clip area is used only for the municipality edge. Small slivers
            # can yield misleadingly high edge densities: expose counts there,
            # not normalized rates when clipped area <25% of full hexagon.
            full=3*math.sqrt(3)*RADIUS**2/2
            if clip.area<full*.25:props.pop("d_km2",None)
            for kind in KINDS:
                if bucket["kind_"+kind]>=MIN and total-bucket["kind_"+kind]>=MIN:
                    props["k"+kind]=bucket["kind_"+kind]
                if bucket["high_kind_"+kind]>=MIN and high-bucket["high_kind_"+kind]>=MIN:
                    props["hk"+kind]=bucket["high_kind_"+kind]
            geom=transform(inv.transform,clip)
            hexes.append({"type":"Feature","properties":props,"geometry":mapping(geom)})
            centroid=clip.representative_point()
            lonc,latc=inv.transform(centroid.x,centroid.y)
            cells.append({**props,"lon":round(lonc,6),"lat":round(latc,6)})
            # Weighted center of the *aggregate hex cell* is not a position of a
            # company or of an IBGE address. Show only sufficiently numerous
            # original/adjusted CNEFE coordinates as smoothed heat intensity.
            if high>=MIN:
                mid=hexshape.representative_point()
                if not boundary.covers(mid):mid=clip.representative_point()
                lon,lat=inv.transform(mid.x,mid.y)
                heat.append({"type":"Feature","properties":{"cell":props["cell"],
                    "w":high,"source":"cnefe2022_hex_center",**{k:v for k,v in props.items() if k.startswith("hk")}},
                    "geometry":{"type":"Point","coordinates":[lon,lat]}})
    if totalcells<300 or len(heat)<80:
        raise RuntimeError(f"Unexpected grid coverage {totalcells}, heat cells {len(heat)}")
    WORK.mkdir(parents=True,exist_ok=True)
    for filename,features in ((hexjson,hexes),(heatjson,heat)):
        filename.write_text(json.dumps({"type":"FeatureCollection","features":features},
                           ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    pm=DATA/"cnefe-hex500.pmtiles"
    subprocess.run(["tippecanoe","-f","-Z","9","-z","15",
       "--no-feature-limit","--no-tile-size-limit",
       "-L",f"hex500:{hexjson}","-L",f"heat500:{heatjson}",
       "-o",str(pm)],check=True,timeout=120)
    if pm.open("rb").read(8)!=b"PMTiles\x03":
        raise RuntimeError("Generated PMTiles v3 is corrupt")
    now=datetime.now(timezone.utc).isoformat()
    meta={"schemaVersion":1,"status":"verified","territory":"4304606",
          "reference":"CNEFE 2022","generatedAt":now,
          "source":SOURCE,"sourceSha256":sha,
          "bairrosSource":"https://geo.canoas.rs.gov.br/server/rest/services/BAIRROSOFICIAL/FeatureServer/0",
          "dataMeaning":"Endereços de estabelecimentos observados no CNEFE 2022; NÃO são CNPJs da Receita",
          "cellWidthMeters":500,"cellDefinition":"Hexágonos regulares com distância entre faces paralelas de 500 metros, EPSG:31982",
          "pmtiles":{"path":"/data/cnefe-hex500.pmtiles","layers":["hex500","heat500"],
                     "bytes":pm.stat().st_size,"sha256":hashlib.sha256(pm.read_bytes()).hexdigest()},
          "coverage":{"allCnefeRecords":processed,"nonResidentialWithCoordinatesInOfficialBairros":selected,
             "notInOfficialBairros":outside,"invalidCoordinates":bad,
             "gridCells":totalcells,"cellsWithNonResidential":len(bycell),
             "heatCellsAtLeastFiveHighQualityAddresses":len(heat),
             "kindCounts":{k:kinds[k] for k in KINDS},
             "geocodingLevelCounts":{k:byquality[k] for k in QUALITY}},
          "kinds":{k:v for k,v in KINDS.items()},
          "quality":QUALITY,
          "cells":cells,
          "privacy":{"minPublishedCellCount":MIN,
                     "individualCoordinatesPublished":False,
                     "householdsPublished":False,
                     "smallCellsSuppressed":True},
          "notes":[
             "CNEFE 2022 registra endereços/espécies, não empresas CNPJ; um endereço pode abrigar múltiplos estabelecimentos.",
             "Esta é uma fonte histórica (Censo 2022), não a fotografia empresarial de outubro de 2026.",
             "Grades calculadas em EPSG:31982, recortadas aos 18 bairros oficiais GeoCanoas.",
             "Mapa de calor suaviza contagens de coordenadas CNEFE por centro de hexágono; os centros NÃO são endereços nem CNPJs.",
             "São considerados somente estabelecimentos de espécies 3, 4, 5, 6 e 8; domicílios e construções excluídos.",
             "Coordenadas CNEFE nível 1–2 formam a camada preferencial de calor; demais níveis são aproximações ou setor.",
             "Células com contagem 1 a 4 são suprimidas nos atributos; valor ausente nunca equivale a zero.",
             "A densidade territorial em hexágonos muito recortados (menos de 25% da área cheia) é ocultada.",
             "Não foram publicados pontos individuais nem dados cadastrais privados."
          ]}
    tmp=DATA/"cnefe-hex500.json.tmp"
    tmp.write_text(json.dumps(meta,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    tmp.replace(DATA/"cnefe-hex500.json")
    print("CNEFE_HEX_OK",json.dumps(meta["coverage"],ensure_ascii=False),
          "PMTILES_BYTES",pm.stat().st_size,flush=True)

if __name__=="__main__":
    extract()
