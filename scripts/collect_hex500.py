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

def hex_neighbors(i,j):
    """Six adjacent flat-to-flat hexagonal cells in an odd-row offset grid."""
    shift=(i-1,i) if j%2==0 else (i,i+1)
    return {(i-1,j),(i+1,j),*((ii,jj) for jj in (j-1,j+1) for ii in shift)}

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
    regions=[(f["properties"]["BAIRRO"],transform(project.transform,shape(f["geometry"]))) for f in feats]
    if len({name for name,_ in regions})!=18:raise RuntimeError("Duplicated official neighborhood names")
    region_prepared=[(name,prep(geom)) for name,geom in regions]
    boundary=unary_union([geom for _,geom in regions])
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
    byregion=defaultdict(Counter)
    byquality=Counter()
    kinds=Counter()
    processed=selected=outside=bad=region_ambiguous=region_unassigned=0
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
                pt=Point(x,y)
                # Classify at the ORIGINAL observed CNEFE coordinate: no
                # hex centroid, interpolated population, or artificial CNPJ.
                matching=[name for name,pgeom in region_prepared if pgeom.covers(pt)]
                if len(matching)==1:
                    reg=byregion[matching[0]]
                    reg["all"]+=1
                    if level in ("1","2"):reg["high"]+=1
                    reg["kind_"+kind]+=1
                elif len(matching)>1:region_ambiguous+=1
                else:region_unassigned+=1
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
    # Optional independently validated RFB CNPJ 500m exact-address matches.
    # Never infer this layer from IBGE establishment counts.
    geo_cnpj=None
    geo_path=DATA/"cnpj-geo-hex500.json"
    if geo_path.exists():
        candidate=json.loads(geo_path.read_text(encoding="utf-8"))
        cnpj_src=json.loads((DATA/"cnpj.json").read_text(encoding="utf-8"))
        if (candidate.get("status")=="verified" and candidate.get("territory")=="4304606"
                and candidate.get("reference")==cnpj_src.get("reference")
                and candidate.get("coverage",{}).get("matched",0)>0):
            geo_cnpj={row["cell"]:row for row in candidate.get("cells",[])}
            print("CNPJ_CNEFE_LAYER_INCLUDED",candidate["reference"],len(geo_cnpj),flush=True)
        else:print("CNPJ_CNEFE_LAYER_STALE: separate source skipped",flush=True)
    x0,y0,x1,y1=bounds
    imin=int(math.floor(x0/SCALE))-2;imax=int(math.ceil(x1/SCALE))+2
    jmin=int(math.floor(y0/DY))-2;jmax=int(math.ceil(y1/DY))+2
    hexes=[];heat=[];cells=[];fragments=[];totalcells=0
    fully_contained={}
    border_cells=0
    spatial_rows={name:{"bairro":name,"areaKm2":round(geom.area/1_000_000,5),
        "fullCells":0,"borderFragments":0,"fullCellAreaKm2":0.,
        "partialAreaKm2":0.,"cnpjPublishedFullCells":0,"cnpjCellsPublished":0}
        for name,geom in regions}
    hexjson=WORK/"hex500.geojson"
    heatjson=WORK/"heat500.geojson"
    hotspotsjson=WORK/"hotspots500.geojson"
    fragmentsjson=WORK/"hex_bairros.geojson"
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
            matched_cell=geo_cnpj.get(props["cell"]) if geo_cnpj else None
            if matched_cell:
                props["cnpj"]=matched_cell["matched"]
                for key,value in matched_cell.items():
                    if key.startswith("s") and len(key)==2 and type(value)==int:
                        props["cs"+key[1]]=value
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
            # True UTM polygon intersection. No proportionally allocated
            # establishment totals: the underlying CNPJ is known per HEX,
            # not per fragment, and edge cells must remain unassigned.
            pieces=[]
            for region,polygon in regions:
                if not clip.intersects(polygon):continue
                part=clip.intersection(polygon)
                if part.is_empty:continue
                if part.geom_type=="GeometryCollection":
                    part=unary_union([p for p in part.geoms
                        if p.geom_type in ("Polygon","MultiPolygon")])
                if part.is_empty or part.geom_type not in ("Polygon","MultiPolygon") or part.area<=.01:continue
                pieces.append((region,part))
            if not pieces or abs(sum(part.area for _,part in pieces)-clip.area)>max(.1,clip.area*.002):
                raise RuntimeError(f"Official bairro intersection fails area conservation for {props['cell']}")
            belongs=len(pieces)==1 and abs(pieces[0][1].area-clip.area)<=max(.1,clip.area*.00001)
            if belongs:fully_contained[props["cell"]]=pieces[0][0]
            else:border_cells+=1
            for name,part in pieces:
                is_full=belongs and name==pieces[0][0]
                summary=spatial_rows[name]
                area=part.area/1_000_000
                if is_full:
                    summary["fullCells"]+=1
                    summary["fullCellAreaKm2"]+=area
                    if isinstance(props.get("cnpj"),int):
                        summary["cnpjPublishedFullCells"]+=props["cnpj"]
                        summary["cnpjCellsPublished"]+=1
                else:
                    summary["borderFragments"]+=1
                    summary["partialAreaKm2"]+=area
                # Counts on cross-boundary fragments are omitted, not
                # copied or prorated. MapLibre paints those in amber.
                props_piece={"cell":props["cell"],"bairro":name,
                    "full":int(is_full),"area_km2":round(area,6),
                    "share_pct":round(100*part.area/clip.area,3)}
                if is_full:props_piece.update(props)
                fragments.append({"type":"Feature","properties":props_piece,
                                  "geometry":mapping(transform(inv.transform,part))})
            # Weighted center of the *aggregate hex cell* is not a position of a
            # company or of an IBGE address. Show only sufficiently numerous
            # original/adjusted CNEFE coordinates as smoothed heat intensity.
            if total>=MIN or high>=MIN or (matched_cell and matched_cell["matched"]>=MIN):
                mid=hexshape.representative_point()
                if not boundary.covers(mid):mid=clip.representative_point()
                lon,lat=inv.transform(mid.x,mid.y)
                heat.append({"type":"Feature","properties":{"cell":props["cell"],
                    "w":safe_public(high),"nw":safe_public(total),"cw":(matched_cell["matched"] if matched_cell else 0),
                    "source":"cnefe2022_hex_center",**{k:v for k,v in props.items() if k.startswith("hk")},
                    **({("cws"+k[1:]):v for k,v in matched_cell.items() if k.startswith("s") and len(k)==2} if matched_cell else {})},
                    "geometry":{"type":"Point","coordinates":[lon,lat]}})
    # Contiguous economic hotspots from the highest quartile of the verified
    # geocoded CNPJ SUBSET. No points or new observations are inferred.
    hotspot_features=[]
    hotspot_summary=[]
    if geo_cnpj:
        pub={f["properties"]["cell"]:f for f in hexes
             if isinstance(f["properties"].get("cnpj"),int)
             and f["properties"]["cnpj"]>=MIN}
        ordered=sorted(f["properties"]["cnpj"] for f in pub.values())
        if len(ordered)>=20:
            cutoff=ordered[math.floor((len(ordered)-1)*0.75)]
            core={id:feature for id,feature in pub.items()
                  if feature["properties"]["cnpj"]>=cutoff}
            neighbors={}
            for key in core:
                ij=key.lstrip("h").split("_")
                i,j=int(ij[0]),int(ij[1])
                # Offset rows: even j connects to upper/lower i-1 and i;
                # odd j to upper/lower i and i+1.
                neighbors[key]={f"h{a}_{b}" for a,b in hex_neighbors(i,j) if f"h{a}_{b}" in core}
            visited=set()
            components=[]
            for key in sorted(core):
                if key in visited:continue
                stack=[key];visited.add(key);group=[]
                while stack:
                    cur=stack.pop();group.append(cur)
                    for nxt in neighbors[cur]-visited:
                        visited.add(nxt);stack.append(nxt)
                size=sum(core[c]["properties"]["cnpj"] for c in group)
                if len(group)>=3 and size>=60:
                    components.append((size,group))
            components.sort(key=lambda x:-x[0])
            for rank,(sum_cnpj,group) in enumerate(components,1):
                union=unary_union([shape(core[k]["geometry"]) for k in group])
                if union.is_empty or union.geom_type not in ("Polygon","MultiPolygon"):
                    raise RuntimeError("Hotspot has invalid polygon geometry")
                point=union.representative_point()
                region=f"nucleo_{rank}"
                hotspot_features.append({"type":"Feature",
                  "properties":{"id":region,"rank":rank,"matched":sum_cnpj,
                      "hexes":len(group),"source":"CNPJ_exact_CNEFE_subset"},
                  "geometry":mapping(union)})
                hotspot_summary.append({"id":region,"rank":rank,
                  "matched":sum_cnpj,"hexagons":len(group),
                  "lon":round(point.x,6),"lat":round(point.y,6)})
    if len(fully_contained)+border_cells!=totalcells:
        raise RuntimeError("Missing hexagon topology")
    if sum(r["all"] for r in byregion.values())+region_ambiguous+region_unassigned!=selected:
        raise RuntimeError("Point-in-bairro accounting mismatch")
    for name,summary in spatial_rows.items():
        cnt=byregion[name]
        summary["observedAddresses"]=safe_public(cnt["all"])
        summary["highQualityAddresses"]=safe_public(cnt["high"])
        summary["observedPerKm2"]=round(cnt["all"]/summary["areaKm2"],2) if cnt["all"]>=MIN and summary["areaKm2"]>0 else None
        summary["cnpjPublishedFullCells"]=safe_public(summary["cnpjPublishedFullCells"])
        summary["fullCellAreaKm2"]=round(summary["fullCellAreaKm2"],5)
        summary["partialAreaKm2"]=round(summary["partialAreaKm2"],5)
        summary["kinds"]={k:safe_public(cnt["kind_"+k]) for k in KINDS}
    actual_heat=sum(1 for row in heat if (row["properties"]["w"] or 0)>=MIN)
    matched_heat=sum(1 for row in heat if row["properties"]["cw"]>=MIN)
    if totalcells<300 or actual_heat<80:
        raise RuntimeError(f"Unexpected grid coverage {totalcells}, heat cells {len(heat)}")
    WORK.mkdir(parents=True,exist_ok=True)
    for filename,features in ((hexjson,hexes),(heatjson,heat),(hotspotsjson,hotspot_features),(fragmentsjson,fragments)):
        filename.write_text(json.dumps({"type":"FeatureCollection","features":features},
                           ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    pm=DATA/"cnefe-hex500.pmtiles"
    subprocess.run(["tippecanoe","-f","-Z","9","-z","15",
       "--no-feature-limit","--no-tile-size-limit",
       "-L",f"hex500:{hexjson}","-L",f"heat500:{heatjson}",
       "-L",f"hotspots500:{hotspotsjson}",
       "-L",f"hex_bairros:{fragmentsjson}",
       "-o",str(pm)],check=True,timeout=120)
    if pm.open("rb").read(8)!=b"PMTiles\x03":
        raise RuntimeError("Generated PMTiles v3 is corrupt")
    now=datetime.now(timezone.utc).isoformat()
    meta={"schemaVersion":1,"status":"verified","territory":"4304606",
          "reference":"CNEFE 2022","generatedAt":now,
          "source":SOURCE,"sourceSha256":sha,
          "bairrosSource":"https://geo.canoas.rs.gov.br/server/rest/services/BAIRROSOFICIAL/FeatureServer/0",
          "dataMeaning":"Endereços de estabelecimentos observados no CNEFE 2022; NÃO são CNPJs da Receita",
          "cellWidthMeters":500,"heatMetricsVersion":2,"spatialOverlayVersion":1,"cellDefinition":"Hexágonos regulares com distância entre faces paralelas de 500 metros, EPSG:31982",
          "pmtiles":{"path":"/data/cnefe-hex500.pmtiles","layers":["hex500","heat500","hotspots500","hex_bairros"],
                     "bytes":pm.stat().st_size,"sha256":hashlib.sha256(pm.read_bytes()).hexdigest()},
          "coverage":{"allCnefeRecords":processed,"nonResidentialWithCoordinatesInOfficialBairros":selected,
             "notInOfficialBairros":outside,"invalidCoordinates":bad,
             "gridCells":totalcells,"cellsWithNonResidential":len(bycell),
             "heatCellsAtLeastFiveHighQualityAddresses":actual_heat,
             "heatCellsWithVerifiedCnpjSubset":matched_heat,
             "kindCounts":{k:kinds[k] for k in KINDS},
             "geocodingLevelCounts":{k:byquality[k] for k in QUALITY}},
          "spatialTopology":{"method":"EPSG:31982 polygon intersection between official bairros and hexagon clipped to municipal boundary",
             "fragments":len(fragments),"fullyContainedHexagons":len(fully_contained),
             "crossBorderHexagons":border_cells,
             "unassignedCnefePointBoundary":region_unassigned,
             "ambiguousCnefePointBoundary":region_ambiguous,
             "fullCellBairro":fully_contained,
             "neighborhoods":sorted(spatial_rows.values(),key=lambda row:row["bairro"])},
          "kinds":{k:v for k,v in KINDS.items()},
          "quality":QUALITY,
          "cnpjMatch":(json.loads(geo_path.read_text(encoding="utf-8"))["coverage"] if geo_cnpj else None),
          "cnpjReference":(json.loads(geo_path.read_text(encoding="utf-8"))["reference"] if geo_cnpj else None),
          "cells":cells,
          "economicHotspots":hotspot_summary,
          "hotspotMethod":"Contiguidade entre hexágonos 500 m; quartil superior de contagens CNPJ conciliação exata, com pelo menos 3 células e 60 observações totais. Apenas o subconjunto geocodificado.",
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
             "Não foram publicados pontos individuais nem dados cadastrais privados.",
             "Os núcleos contíguos são derivados apenas de hexágonos empresariais publicáveis do subconjunto RFB/CNEFE.",
             "Divisas: interseção geométrica exata em EPSG:31982; contagens CNPJ ou CNEFE por hexágono não são rateadas aos fragmentos.",
             "Totais CNEFE por bairro são contados nas coordenadas observadas originais, diretamente dentro dos polígonos oficiais.",
             "CNPJs no bairro em células totalmente contidas representam apenas o mínimo publicável do subconjunto geocodificado, não o total do bairro."
          ]}
    tmp=DATA/"cnefe-hex500.json.tmp"
    tmp.write_text(json.dumps(meta,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    tmp.replace(DATA/"cnefe-hex500.json")
    print("CNEFE_HEX_OK",json.dumps(meta["coverage"],ensure_ascii=False),
          "PMTILES_BYTES",pm.stat().st_size,flush=True)

if __name__=="__main__":
    extract()
