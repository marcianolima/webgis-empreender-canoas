#!/usr/bin/env python3
"""Receita Federal CNPJ — processamento INTEGRAL por fragmentos no GitHub Actions.

Apenas URL oficial da RFB (WebDAV público). Não publica registros individualizados.
Fases: discover, shard --index 0..9, assemble. Requer todos os 10 fragmentos
de Estabelecimentos + 10 Empresas + Simples + Municipios + Cnaes.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import os
import re
import shutil
import sqlite3
import sys
import tempfile
import time
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

TOKEN = "YggdBLfdninEJX9"
ROOT = "https://arquivos.receitafederal.gov.br/public.php/dav/files/" + TOKEN + "/"
REF_PATTERN = re.compile(r"^20[0-9]{2}-(0[1-9]|1[0-2])$")
WORK = Path("work/cnpj")
REQUIRED = ([f"Estabelecimentos{i}.zip" for i in range(10)]
            + [f"Empresas{i}.zip" for i in range(10)]
            + ["Municipios.zip", "Simples.zip", "Cnaes.zip"])
LABELS = {
    "A": "Agricultura, pecuária e pesca", "B": "Indústrias extrativas",
    "C": "Indústrias de transformação", "D": "Eletricidade e gás",
    "E": "Água, esgoto e resíduos", "F": "Construção",
    "G": "Comércio e reparação de veículos", "H": "Transporte e armazenagem",
    "I": "Alojamento e alimentação", "J": "Informação e comunicação",
    "K": "Atividades financeiras", "L": "Atividades imobiliárias",
    "M": "Atividades profissionais e técnicas",
    "N": "Atividades administrativas", "O": "Administração pública",
    "P": "Educação", "Q": "Saúde e serviços sociais",
    "R": "Artes, cultura e esportes", "S": "Outros serviços",
    "T": "Serviços domésticos", "U": "Organismos internacionais",
}
RANGES = [
    (1, 3, "A"), (5, 9, "B"), (10, 33, "C"), (35, 35, "D"),
    (36, 39, "E"), (41, 43, "F"), (45, 47, "G"), (49, 53, "H"),
    (55, 56, "I"), (58, 63, "J"), (64, 66, "K"), (68, 68, "L"),
    (69, 75, "M"), (77, 82, "N"), (84, 84, "O"), (85, 85, "P"),
    (86, 88, "Q"), (90, 93, "R"), (94, 96, "S"), (97, 97, "T"),
    (99, 99, "U"),
]

def auth():
    import base64
    return "Basic " + base64.b64encode((TOKEN + ":").encode()).decode()

def url_of(reference, filename):
    if not REF_PATTERN.fullmatch(reference):
        raise ValueError("Competência inválida")
    if filename not in REQUIRED:
        raise ValueError("Arquivo fora da lista oficial permitida")
    return ROOT + reference + "/" + filename

def open_url(url, method="GET", data=None, additional=None, timeout=90):
    if not url.startswith(ROOT):
        raise ValueError("Host não autorizado")
    headers = {"Authorization": auth(), "User-Agent": "CanoasEmpreende/1.0 (public CNPJ)",
               "Accept-Encoding": "identity"}
    headers.update(additional or {})
    return urllib.request.urlopen(
        urllib.request.Request(url, data=data, headers=headers, method=method), timeout=timeout
    )

def list_directory(directory=""):
    url = ROOT + directory
    with open_url(url, method="PROPFIND",
                  data=b'<d:propfind xmlns:d="DAV:"><d:allprop/></d:propfind>',
                  additional={"Depth": "1"}, timeout=35) as stream:
        tree = ET.fromstring(stream.read(1_000_000))
    return [
        urllib.parse.unquote(n.text or "").rstrip("/").split("/")[-1]
        for n in tree.findall(".//{DAV:}href")
    ]

def discover(reference="auto"):
    if reference != "auto":
        if not REF_PATTERN.fullmatch(reference):
            raise ValueError("Formato de competência esperado AAAA-MM")
        candidates = [reference]
    else:
        candidates = sorted((v for v in list_directory() if REF_PATTERN.fullmatch(v)), reverse=True)
    for month in candidates:
        try:
            found = set(list_directory(month + "/"))
            if set(REQUIRED).issubset(found):
                print("snapshot=" + month, flush=True)
                return month
        except (OSError, ET.ParseError) as error:
            print("Pasta indisponível", month, error, file=sys.stderr)
    raise RuntimeError("Nenhuma competência completa: exigidos 10 Empresas, 10 Estabelecimentos, Simples, Municipios, Cnaes")

def get_zip(reference, filename):
    WORK.mkdir(parents=True, exist_ok=True)
    url = url_of(reference, filename)
    final = WORK / filename
    expected = None
    for attempt in range(4):
        try:
            with open_url(url, method="HEAD", timeout=35) as response:
                expected = int(response.headers.get("Content-Length", "0")) or None
            if expected and expected > 3_500_000_000:
                raise ValueError("Fragmento maior que o limite operacional de 3,5 GB")
            if final.exists() and expected and final.stat().st_size == expected:
                return final
            partial = final.with_suffix(".download")
            length = partial.stat().st_size if partial.exists() else 0
            headers = {"Range": f"bytes={length}-"} if length else {}
            with open_url(url, additional=headers, timeout=100) as response:
                status = response.status
                mode = "ab" if length and status == 206 else "wb"
                with partial.open(mode) as target:
                    while True:
                        block = response.read(4 * 1024 * 1024)
                        if not block:
                            break
                        target.write(block)
            if expected and partial.stat().st_size != expected:
                raise IOError(f"Download incompleto: {partial.stat().st_size}/{expected}")
            if not zipfile.is_zipfile(partial):
                raise ValueError("Resposta não é arquivo ZIP válido")
            partial.replace(final)
            return final
        except Exception as error:
            print("Tentativa", attempt + 1, filename, str(error), file=sys.stderr, flush=True)
            if attempt == 3:
                raise
            time.sleep(3 * (attempt + 1))
    raise RuntimeError("Download falhou")

def csv_zip(path):
    with zipfile.ZipFile(path) as archive:
        members = [i for i in archive.infolist() if not i.is_dir()]
        if len(members) != 1:
            raise ValueError(f"Arquivo {path.name}: esperado exatamente um CSV interno")
        with archive.open(members[0]) as binary:
            with io.TextIOWrapper(binary, encoding="latin-1", newline="") as text:
                yield from csv.reader(text, delimiter=";", quotechar='"')

def municipality_code(reference):
    file = get_zip(reference, "Municipios.zip")
    matches = {row[0].strip() for row in csv_zip(file)
               if len(row) > 1 and normalize(row[1]) == "CANOAS"}
    file.unlink()
    if len(matches) != 1:
        raise ValueError(f"Código municipal Receita ambíguo: {matches}")
    return matches.pop()

def normalize(value):
    value = unicodedata.normalize("NFKD", str(value).strip().upper())
    return " ".join("".join(c for c in value if not unicodedata.combining(c)).split())

def iso(raw):
    value = raw.strip()
    if len(value) != 8 or not value.isdecimal():
        return ""
    try:
        return date(int(value[:4]), int(value[4:6]), int(value[6:])).isoformat()
    except ValueError:
        return ""

def file_sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(2 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def shard(reference, index):
    if index not in range(10):
        raise ValueError("index precisa ser 0..9")
    municipio = municipality_code(reference)
    filename = f"Estabelecimentos{index}.zip"
    source = get_zip(reference, filename)
    sha = file_sha(source)
    target = WORK / f"shard-{index}.csv.gz"
    scanned = accepted = invalid = 0
    with gzip.open(target, "wt", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream)
        for row in csv_zip(source):
            scanned += 1
            if len(row) < 21:
                invalid += 1
                continue
            if row[19].strip() != "RS" or row[20].strip() != municipio:
                continue
            basic = row[0].strip()
            order = row[1].strip()
            suffix = row[2].strip()
            if not (len(basic) == 8 and len(order) == 4 and len(suffix) == 2):
                invalid += 1
                continue
            writer.writerow([
                basic + order + suffix, basic, row[3].strip(), row[5].strip(),
                iso(row[10]), iso(row[6]), row[11].strip(),
                normalize(row[17])[:60], row[18].strip(),
            ])
            accepted += 1
    # Optional, privacy-preserving exact-address CNEFE match on the still-local RFB
    # ZIP. It emits only 500m cell counters; the ZIP is deleted immediately after.
    try:
        from cnpj_geo import match_shard
        match_shard(reference,index,municipio,source,csv_zip)
    except Exception as geo_error:
        print("AVISO CNPJ_CNEFE_MATCH indisponível no fragmento",
              index, repr(geo_error), file=sys.stderr, flush=True)
    source.unlink(missing_ok=True)
    manifest = {
        "reference": reference, "index": index, "sourceFile": filename,
        "sourceUrl": url_of(reference, filename), "sha256": sha,
        "rowsRead": scanned, "rowsCanoas": accepted, "invalid": invalid,
        "municipioReceita": municipio,
    }
    (WORK / f"shard-{index}.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    if scanned < 1000 or accepted < 10:
        raise RuntimeError(f"Fragmento aparentemente incompleto: {manifest}")
    print("SHARD", json.dumps(manifest, ensure_ascii=False), flush=True)

def section(cnae):
    try:
        division = int(cnae[:2])
    except ValueError:
        return "?"
    return next((letter for minimum, maximum, letter in RANGES
                 if minimum <= division <= maximum), "?")

def top(counter, limit=None, threshold=1):
    entries = [{"name": key, "count": count} for key, count in counter.items() if count >= threshold]
    entries.sort(key=lambda item: (-item["count"], item["name"]))
    return entries[:limit] if limit else entries

def assemble(reference, source_dir):
    manifests = []
    for i in range(10):
        meta = json.loads((source_dir / f"shard-{i}.json").read_text())
        if meta["reference"] != reference or meta["index"] != i:
            raise ValueError("Manifesto inconsistente: competência/fragmento")
        if meta["rowsRead"] < 1000 or meta["rowsCanoas"] < 10:
            raise ValueError("Fragmento incompleto")
        manifests.append(meta)
    if len({x["index"] for x in manifests}) != 10 or len({x["municipioReceita"] for x in manifests}) != 1:
        raise ValueError("Fragmentos repetidos / municípios distintos")
    with tempfile.TemporaryDirectory(prefix="cnpj_canoas_") as folder:
        conn = sqlite3.connect(Path(folder) / "canoas.sqlite")
        conn.execute("CREATE TABLE establishments (cnpj TEXT PRIMARY KEY,basico TEXT,matriz TEXT,status TEXT,opened TEXT,closed TEXT,cnae TEXT,bairro TEXT,cep TEXT,porte TEXT,natureza TEXT,mei TEXT,simples TEXT)")
        insert = "INSERT INTO establishments(cnpj,basico,matriz,status,opened,closed,cnae,bairro,cep) VALUES (?,?,?,?,?,?,?,?,?)"
        batch = []
        for i in range(10):
            with gzip.open(source_dir / f"shard-{i}.csv.gz", "rt", encoding="utf-8", newline="") as stream:
                for row in csv.reader(stream):
                    if len(row) != 9:
                        raise ValueError("Colunas inesperadas no fragmento")
                    batch.append(row)
                    if len(batch) == 4000:
                        conn.executemany(insert, batch)
                        conn.commit()
                        batch.clear()
        if batch:
            conn.executemany(insert, batch)
            conn.commit()
        conn.execute("CREATE INDEX idx_basic ON establishments(basico)")
        count = conn.execute("SELECT COUNT(*) FROM establishments").fetchone()[0]
        expected = sum(x["rowsCanoas"] for x in manifests)
        if count != expected or count < 1000:
            raise ValueError(f"Cobertura parcial ou CNPJ duplicado: {count}/{expected}")
        basicos = {r[0] for r in conn.execute("SELECT DISTINCT basico FROM establishments")}
        print("BASE COMPLETA", reference, "Estabelecimentos Canoas", count, "raízes", len(basicos), flush=True)

        sources = manifests[:]
        for i in range(10):
            name = f"Empresas{i}.zip"
            path = get_zip(reference, name)
            sha = file_sha(path)
            scanned = matched = 0
            batch = []
            for row in csv_zip(path):
                scanned += 1
                if len(row) < 6:
                    continue
                basic = row[0].strip()
                if basic in basicos:
                    batch.append((row[5].strip(), row[2].strip(), basic))
                    matched += 1
                    if len(batch) >= 1000:
                        conn.executemany("UPDATE establishments SET porte=?, natureza=? WHERE basico=?", batch)
                        conn.commit()
                        batch.clear()
            if batch:
                conn.executemany("UPDATE establishments SET porte=?, natureza=? WHERE basico=?", batch)
                conn.commit()
            path.unlink(missing_ok=True)
            sources.append({"sourceFile": name, "sourceUrl": url_of(reference,name),
                            "sha256": sha, "rowsRead": scanned, "matchedBasics": matched})
            print("EMPRESAS", name, scanned, matched, flush=True)
            if scanned < 1000:
                raise ValueError(f"Empresas inválido: {name}")

        name = "Simples.zip"
        path = get_zip(reference, name)
        sha = file_sha(path)
        scanned = matched = 0
        batch = []
        for row in csv_zip(path):
            scanned += 1
            if len(row) < 5:
                continue
            basic = row[0].strip()
            if basic in basicos:
                batch.append((row[1].strip(), row[4].strip(), basic))
                matched += 1
                if len(batch) >= 1000:
                    conn.executemany("UPDATE establishments SET simples=?,mei=? WHERE basico=?",batch)
                    conn.commit()
                    batch.clear()
        if batch:
            conn.executemany("UPDATE establishments SET simples=?,mei=? WHERE basico=?",batch)
            conn.commit()
        path.unlink(missing_ok=True)
        sources.append({"sourceFile": name, "sourceUrl": url_of(reference,name),
                        "sha256": sha, "rowsRead": scanned, "matchedBasics": matched})
        if scanned < 1000:
            raise ValueError("Arquivo Simples incompleto")
        print("SIMPLES", scanned, matched, flush=True)

        cnae_file = get_zip(reference, "Cnaes.zip")
        cnae_names = {row[0].strip(): row[1].strip()
                      for row in csv_zip(cnae_file) if len(row) >= 2}
        sources.append({"sourceFile": "Cnaes.zip",
                        "sourceUrl": url_of(reference,"Cnaes.zip"), "sha256": file_sha(cnae_file)})
        cnae_file.unlink(missing_ok=True)

        status = Counter()
        sector = Counter()
        divisions = Counter()
        porte = Counter()
        districts = Counter()
        mei = Counter()
        simples = Counter()
        openings = Counter()
        closings = Counter()
        sector_bairro = Counter()
        matrix = Counter()
        bad_dates = 0
        for st, code, district, start, end, size, is_mei, is_simples, matriz in conn.execute(
            "SELECT status,cnae,bairro,opened,closed,porte,mei,simples,matriz FROM establishments"
        ):
            status[st or ""] += 1
            matrix[matriz or "?"] += 1
            sec = section(code or "")
            if start:
                openings[start[:7]] += 1
            else:
                bad_dates += 1
            if st == "08" and end:
                closings[end[:7]] += 1
            if st == "02":
                sector[sec] += 1
                divisions[(code or "")[:2]] += 1
                porte[size or "?"] += 1
                mei[is_mei or "?"] += 1
                simples[is_simples or "?"] += 1
                key_district = district or "NAO INFORMADO"
                districts[key_district] += 1
                sector_bairro[(key_district,sec)] += 1

        active = status["02"]
        refyear = reference[:4]
        refmonth = reference
        open_year = sum(v for k,v in openings.items() if k.startswith(refyear))
        close_year = sum(v for k,v in closings.items() if k.startswith(refyear))
        published = {
            "schemaVersion": 1,
            "status": "official",
            "reference": reference,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "source": "Receita Federal — Dados Abertos do CNPJ",
            "sourceUrl": ROOT + reference + "/",
            "municipality": "Canoas",
            "municipalityIbgeCode": "4304606",
            "municipalityRfbCode": manifests[0]["municipioReceita"],
            "unit": "estabelecimentos CNPJ (matrizes + filiais)",
            "coverage": {"establishmentShards": 10, "companyShards": 10,
                         "simplesLoaded": True, "totalRowsReadEstablishments": sum(v["rowsRead"] for v in manifests),
                         "recordsMunicipality": count, "dateFieldOrderVerified": True, "missingStartDates": bad_dates,
                         "companyMatchedBasics": sum(v.get("matchedBasics",0) for v in sources)},
            "kpis": {
                "total": count, "active": active, "baixados_snapshot": status["08"],
                "openMonth": openings[refmonth], "openYear": open_year,
                "closedYearLatestSituation": close_year,
                "balanceYearProxy": open_year - close_year,
                "meiActive": mei["S"], "meiKnown": mei["S"] + mei["N"],
                "simplesActive": simples["S"], "simplesKnown": simples["S"] + simples["N"],
            },
            "statusBreakdown": top(status),
            "matrizBreakdown": top(matrix),
            "bySector": [{"name": key, "label": LABELS.get(key,"Não classificado"), "count": val}
                         for key,val in sorted(sector.items(),key=lambda row:-row[1])],
            "byCnaeDivision": top(divisions, 40),
            "byPorte": top(porte),
            "byDistrictDeclared": top(districts, 50, 5),
            "byMei": top(mei),
            "bySimples": top(simples),
            "monthly": [{"month": k, "openings": openings.get(k,0),
                         "closingsLatestSituation": closings.get(k,0)}
                        for k in sorted(set(openings)|set(closings)) if k >= "2021-01" and k <= reference],
            "districtSectorCells": [
                {"district": district,"sector": sec,"count": n}
                for (district,sec),n in sorted(sector_bairro.items()) if n >= 5
            ],
            "cnaeLabels": {code:label for code,label in cnae_names.items()
                           if code[:2] in divisions},
            "quality": {
                "locationPrecision": "bairro cadastral declarativo; sem geocodificação",
                "geocodedRecords": 0,
                "notes": [
                    "Estabelecimentos contam matriz e filial separadamente.",
                    "Aberturas pela data de início da atividade incluem cadastros hoje baixados.",
                    "Baixas no período: situação cadastral 08 na fotografia com data da situação; não reconstrói eventos anteriores.",
                    "Saldo é uma aproximação (aberturas − baixas da última situação), não diferença entre snapshots de estoque.",
                    "MEI/Simples pela opção cadastral de Empresas/Simples; percentuais usam apenas optantes com situação conhecida.",
                    "Bairro é campo informado à RFB; não validado contra os polígonos municipais.",
                    "Células de bairro × seção com menos de cinco empresas são omitidas por minimização.",
                    "Datas RFB verificadas: início de atividade na coluna 10 e situação cadastral na coluna 6 de Estabelecimentos.",
                    "Nenhum CNPJ, nome, endereço individual ou dado de sócios é publicado."
                ],
                "sources": sources,
            },
        }
        out = Path("public/data/cnpj.json")
        out.parent.mkdir(parents=True, exist_ok=True)
        tmp = out.with_suffix(".tmp")
        tmp.write_text(json.dumps(published, ensure_ascii=False, separators=(",", ":")) + "\n",encoding="utf-8")
        if len(published["monthly"]) < 12 or sum(x["count"] for x in published["bySector"]) != active:
            raise ValueError("Validação de séries/total ativos não passou")
        tmp.replace(out)
        print("PUBLICADO", out, "CNPJ Canoas", count, "ativos", active, "competência", reference, flush=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["discover", "shard", "assemble"])
    parser.add_argument("--reference", default="auto")
    parser.add_argument("--index", type=int)
    parser.add_argument("--source-dir", type=Path, default=Path("work/shards"))
    args = parser.parse_args()
    reference = discover(args.reference) if args.command == "discover" else args.reference
    if args.command == "discover":
        return
    if not REF_PATTERN.fullmatch(reference):
        raise ValueError("Competência concreta obrigatória para shard/assemble")
    if args.command == "shard":
        shard(reference, args.index)
    else:
        assemble(reference, args.source_dir)

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("ERRO CNPJ (nenhum dado parcial publicado):", repr(exc), file=sys.stderr, flush=True)
        sys.exit(1)
