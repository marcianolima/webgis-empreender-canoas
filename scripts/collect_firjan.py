#!/usr/bin/env python3
"""Export the official Firjan IFDM 2025 revised history for Canoas.

The XLSX stays with Firjan; publish only 11 municipal aggregates with sources.
All parsing uses Python stdlib (XML inside OOXML/ZIP) for auditable ETL.
"""
from __future__ import annotations

import io
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "data" / "ifdm-firjan.json"
SOURCE = ("https://www.firjan.com.br/data/files/09/42/7A/34/"
          "0EFA6910734FAA69D8284EA8/Serie-Historica-IFDM-2013-a-2023.xlsx")
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
KEYS = ("general", "education", "health", "employmentIncome")
YEARS = range(2013, 2024)


def column(n: int) -> str:
    """Zero-based column index to Excel A1 column."""
    out = ""
    n += 1
    while n:
        out = chr(65 + (n - 1) % 26) + out
        n = (n - 1) // 26
    return out


def cell_values(row: ET.Element, strings: list[str]) -> dict[str, str]:
    result = {}
    for c in row.findall(NS + "c"):
        reference = c.get("r", "")
        match = re.match(r"([A-Z]+)\d+$", reference)
        if not match:
            continue
        v = c.find(NS + "v")
        if v is not None and v.text is not None:
            content = strings[int(v.text)] if c.get("t") == "s" else v.text
        elif c.get("t") == "inlineStr":
            content = "".join(t.text or "" for t in c.iter(NS + "t"))
        else:
            content = ""
        result[match.group(1)] = content
    return result


def read_sheet(z: zipfile.ZipFile, path: str, strings: list[str], key: str) -> dict:
    first = None
    matches = []
    for _, elem in ET.iterparse(io.BytesIO(z.read(path)), events=("end",)):
        if elem.tag != NS + "row":
            continue
        fields = cell_values(elem, strings)
        if first is None:
            first = fields
        if fields.get("A") == "430460" and fields.get("B") == "RS" and fields.get("C") == "Canoas":
            matches.append(fields)
        elem.clear()
    if len(matches) != 1 or first is None:
        raise ValueError(f"Municipal source record mismatch in {path}: {len(matches)}")
    required = {"general": "IFDM ", "education": "IFDM Educação ",
                "health": "IFDM Saúde ", "employmentIncome": "IFDM Emprego "}
    # Make sure workbooks/sheets have not been reordered or modified.
    for i, year in enumerate(YEARS):
        col = column(5 + i * 3)
        head = first.get(col, "")
        if not head.startswith(required[key]) or str(year) not in head:
            raise ValueError(f"Unexpected column heading {path}:{col}: {head!r}")
    return matches[0]


def parse_workbook(blob: bytes) -> dict:
    if not (10_000 <= len(blob) <= 14_000_000) or not blob.startswith(b"PK\x03\x04"):
        raise ValueError("Invalid Firjan XLSX archive")
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        if "xl/sharedStrings.xml" not in z.namelist():
            raise ValueError("Shared strings missing from official Firjan workbook")
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        strings = ["".join(t.text or "" for t in si.iter(NS + "t")) for si in root.iter(NS + "si")]
        sheets = {
            key: read_sheet(z, f"xl/worksheets/sheet{i}.xml", strings, key)
            for i, key in enumerate(KEYS, 1)
        }
    series = []
    for i, year in enumerate(YEARS):
        item: dict = {"year": year, "values": {}, "ranking": {}}
        for key in KEYS:
            row = sheets[key]
            base = 3 + i * 3
            state = int(row[column(base)])
            brazil = int(row[column(base + 1)])
            value = round(float(row[column(base + 2)]), 4)
            if not (0 <= value <= 1 and state > 0 and brazil > 0):
                raise ValueError(f"Invalid IFDM {year} {key} {value}")
            item["values"][key] = value
            item["ranking"][key] = {"state": state, "brazil": brazil}
        calculated = sum(item["values"][k] for k in KEYS[1:]) / 3
        if abs(item["values"]["general"] - calculated) > 0.00007:
            raise ValueError(f"IFDM general not the arithmetic mean in {year}")
        series.append(item)

    assert len(series) == 11 and series[-1]["year"] == 2023
    return {
        "schemaVersion": 1,
        "status": "verified",
        "source": "Firjan – Índice Firjan de Desenvolvimento Municipal (IFDM)",
        "sourceUrl": SOURCE,
        "publicationUrl": "https://www.firjan.com.br/ifdm/downloads/",
        "methodologyUrl": "https://www.firjan.com.br/ifdm/consulta-ao-indice/consulta-ao-indice.htm",
        "edition": 2025,
        "referenceYear": 2023,
        "territory": "4304606",
        "sourceMunicipalityCode": "430460",
        "municipality": "Canoas",
        "state": "RS",
        "range": {"start": 2013, "end": 2023, "count": 11},
        "scale": {"min": 0, "max": 1, "criticalBelow": 0.4,
                  "lowBelow": 0.6, "moderateBelow": 0.8},
        "notes": [
            "Série histórica da edição IFDM 2025, recalculada pela metodologia revisada. Não conectar séries de edições metodologicamente distintas.",
            "Ano-base 2023 é a última referência disponível na edição 2025, não representa uma medição de 2026.",
            "Índice de 0 a 1; desenvolvimento crítico <0,4; baixo de 0,4 a <0,6; moderado de 0,6 a <0,8; alto ≥0,8.",
            "O código municipal de seis dígitos 430460 utilizado pela Firjan corresponde ao IBGE 4304606 (Canoas).",
        ],
        "series": series,
    }


def collect() -> None:
    request = urllib.request.Request(
        SOURCE, headers={
            "User-Agent": "Mozilla/5.0 (compatible; Canoas open data/1.0)",
            "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
        })
    with urllib.request.urlopen(request, timeout=48) as reply:
        if reply.status != 200:
            raise RuntimeError(f"Firjan HTTP {reply.status}")
        payload = reply.read(14_000_001)
    result = parse_workbook(payload)
    # Publication only occurs after all schema, municipality, year and index
    # consistency checks passed. Never manufacture absent observations.
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("IFDM_FIRJAN_OK", result["territory"], result["range"],
          result["series"][-1]["values"], flush=True)


if __name__ == "__main__":
    collect()
