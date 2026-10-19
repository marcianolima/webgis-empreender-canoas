#!/usr/bin/env python3
"""Read Firjan IFGF edition 2025 municipal fiscal series, 2013–2024.

Official XLSX is parsed with Python stdlib (ZIP + OOXML). No scraping
from HTML, no speculative rankings, and no invented/fill-forward years.
"""
from __future__ import annotations

import io
import json
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from collect_firjan import NS, cell_values, column

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "data" / "ifgf-firjan.json"
SOURCE = ("https://firjan.com.br/data/files/86/20/2F/AC/"
          "1345991031B91689D8284EA8/Evolucao_por_Indicador_2013_a_2024_IFGF_2025.xlsx")
KEYS = ("general", "autonomy", "personnel", "liquidity", "investment")
LABELS = ("IFGF ", "IFGF Autonomia ", "IFGF Gastos com Pessoal ",
          "IFGF Liquidez ", "IFGF Investimentos ")


def parse_workbook(blob: bytes) -> dict:
    if not (10_000 <= len(blob) <= 11_000_000) or blob[:4] != b"PK\x03\x04":
        raise ValueError("Firjan IFGF workbook absent or corrupt")
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        strings = ["".join(t.text or "" for t in si.iter(NS + "t")) for si in root.iter(NS + "si")]
        by_dimension: dict[str, dict[str, str]] = {}
        for i, (key, label) in enumerate(zip(KEYS, LABELS), 1):
            path = f"xl/worksheets/sheet{i}.xml"
            header = None
            candidates = []
            for _, elem in ET.iterparse(io.BytesIO(z.read(path)), events=("end",)):
                if elem.tag != NS + "row":
                    continue
                row = cell_values(elem, strings)
                if header is None:
                    header = row
                if row.get("A") == "430460" and row.get("B") == "RS" and row.get("C") == "Canoas":
                    candidates.append(row)
                elem.clear()
            if header is None or len(candidates) != 1:
                raise ValueError(f"IFGF municipality not found uniquely in {path}: {len(candidates)}")
            for step, year in enumerate(range(2013, 2025)):
                col = column(3 + step)
                if header.get(col) != f"{label}{year}":
                    raise ValueError(f"IFGF header changed in {path}/{col}: {header.get(col)!r}")
            by_dimension[key] = candidates[0]

    series = []
    for step, year in enumerate(range(2013, 2025)):
        col = column(3 + step)
        values = {}
        for key in KEYS:
            raw = by_dimension[key].get(col, "")
            if not raw:
                raise ValueError(f"IFGF missing value in {year} for {key}")
            value = round(float(raw), 4)
            if not (0 <= value <= 1):
                raise ValueError(f"IFGF value out of range for {year}/{key}")
            values[key] = value
        expected = (values["autonomy"] + values["personnel"] +
                    values["liquidity"] + values["investment"]) / 4
        if abs(expected - values["general"]) > 0.00008:
            raise ValueError(f"IFGF mean not conserved for {year}")
        series.append({"year": year, "values": values})

    return {
        "schemaVersion": 1,
        "status": "verified",
        "source": "Firjan — Índice Firjan de Gestão Fiscal (IFGF)",
        "sourceUrl": SOURCE,
        "publicationUrl": "https://firjan.com.br/ifgf/analises-e-rankings/",
        "methodologyUrl": "https://www.firjan.com.br/ifgf/metodologia/metodologia.htm",
        "edition": 2025,
        "referenceYear": 2024,
        "territory": "4304606",
        "sourceMunicipalityCode": "430460",
        "municipality": "Canoas",
        "state": "RS",
        "range": {"start": 2013, "end": 2024, "count": 12},
        "scale": {"min": 0, "max": 1, "criticalBelow": 0.4,
                  "difficultyBelow": 0.6, "goodBelow": 0.8},
        "notes": [
            "Índice de Gestão Fiscal IFGF não se confunde com IFDM de desenvolvimento socioeconômico.",
            "Ano-base 2024 corresponde à edição IFGF 2025 e não representa 2026.",
            "Os quatro componentes têm mesmo peso (25% cada): Autonomia, Gastos com Pessoal, Liquidez e Investimentos.",
            "Os valores são notas padronizadas 0–1; não representam percentuais de gastos, receita, dívida ou investimento.",
            "A planilha de série histórica Firjan não inclui ranking estadual/nacional: não foram inventadas posições.",
            "O município utiliza o código 430460 na planilha Firjan, equivalente ao IBGE 4304606.",
        ],
        "series": series,
    }


def collect() -> None:
    request = urllib.request.Request(
        SOURCE, headers={"User-Agent": "Mozilla/5.0 (Canoas official open-data ETL)",
                         "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*"})
    with urllib.request.urlopen(request, timeout=48) as response:
        if response.status != 200:
            raise RuntimeError(f"Firjan IFGF HTTP {response.status}")
        blob = response.read(11_000_001)
    result = parse_workbook(blob)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("IFGF_FIRJAN_OK", result["municipality"], result["range"], result["series"][-1], flush=True)


if __name__ == "__main__":
    collect()
