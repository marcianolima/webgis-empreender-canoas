#!/usr/bin/env python3
"""Recolhe APENAS dados oficiais agregados: IBGE SIDRA e Dados RS/JUCISRS.

Utiliza só a biblioteca padrão do Python. Publica arquivos estáticos leves para
GitHub Pages. Nunca cria valores de exemplo; quando não há dados, sinaliza falta.
Uso: python scripts/collect_official.py
"""
from __future__ import annotations

import csv
import gzip
import io
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public" / "data"
IBGE = "https://servicodados.ibge.gov.br/api/v3/agregados"
MUNICIPIO = "4304606"
MALHA = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/municipios/4304606?"
    "formato=application/vnd.geo%2Bjson&qualidade=minima"
)
PACKAGE = "https://dados.rs.gov.br/api/3/action/package_show?id="
MONTHS = {
    "JAN": 1, "FEV": 2, "MAR": 3, "ABR": 4, "MAI": 5, "JUN": 6,
    "JUL": 7, "AGO": 8, "SET": 9, "OUT": 10, "NOV": 11, "DEZ": 12,
}
RS_DATASETS = {
    "constituidas": "empresas-constituidas",
    "extintas": "extincao-empresas",
    "filiais_abertas": "abertura-filiais",
    "filiais_encerradas": "encerramento-de-filiais",
}


def download(url: str, *, retries: int = 1, max_bytes: int = 8_000_000) -> bytes:
    err = None
    for attempt in range(retries + 1):
        try:
            request = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (CanoasEmpreende/0.2)",
                "Accept": "application/json,text/csv,*/*",
                "Accept-Encoding": "identity",
            })
            with urllib.request.urlopen(request, timeout=18) as reply:
                if reply.status != 200:
                    raise RuntimeError(f"HTTP {reply.status}")
                payload = reply.read(max_bytes + 1)
                if len(payload) > max_bytes:
                    raise ValueError("Fonte excede o limite previsto")
                return payload
        except (OSError, urllib.error.URLError, RuntimeError) as ex:
            err = ex
            if attempt < retries:
                time.sleep(2 + attempt * 2)
    raise RuntimeError(f"Fonte indisponível: {url} ({err})")


def get_json(url: str):
    raw = download(url)
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    return json.loads(raw.decode("utf-8-sig"))


def numeric(value: str):
    """SIDRA: '-'/'...'/'X' são ausências, jamais zeros."""
    value = str(value).strip()
    if value in {"", "-", "...", "..", "X", "x"}:
        return None
    try:
        result = float(value.replace(",", "."))
        return int(result) if result.is_integer() else result
    except ValueError:
        return None


def sidra_series(table: int, variable: int, years: list[int]) -> list[dict]:
    url = (
        f"{IBGE}/{table}/periodos/" + "%7C".join(str(year) for year in years) +
        f"/variaveis/{variable}?localidades=N6%5B{MUNICIPIO}%5D"
    )
    payload = get_json(url)
    output = []
    for variable_data in payload:
        for result in variable_data.get("resultados", []):
            if result.get("classificacoes") and any(
                list(cl.get("categoria", {}).keys()) != ["0"]
                for cl in result["classificacoes"]
            ):
                continue
            for row in result.get("series", []):
                if str(row.get("localidade", {}).get("id")) != MUNICIPIO:
                    continue
                for year, raw in row.get("serie", {}).items():
                    if int(year) not in years:
                        continue
                    value = numeric(raw)
                    if value is not None:
                        output.append({"year": int(year), "value": value})
    return sorted(output, key=lambda item: item["year"])


def sidra_sections() -> list[dict]:
    """Seções CNAE da tabela 993, fotografia histórica 2021."""
    meta = get_json(f"{IBGE}/993/metadados")
    classification = next(c for c in meta["classificacoes"] if int(c["id"]) == 12762)
    categories = {
        str(c["id"]): c["nome"]
        for c in classification["categorias"] if c.get("nivel") == 1
    }
    url = (
        f"{IBGE}/993/periodos/2021/variaveis/2585?"
        f"localidades=N6%5B{MUNICIPIO}%5D"
        "&classificacao=12762%5Ball%5D%7C319%5B0%5D%7C12386%5B0%5D"
    )
    result = get_json(url)
    out = []
    for var in result:
        for item in var.get("resultados", []):
            cl = next((c for c in item.get("classificacoes", []) if str(c["id"]) == "12762"), None)
            if not cl:
                continue
            category = cl.get("categoria", {})
            for cat, name in category.items():
                if cat not in categories:
                    continue
                for series in item.get("series", []):
                    if str(series.get("localidade", {}).get("id")) != MUNICIPIO:
                        continue
                    value = numeric(series.get("serie", {}).get("2021", ""))
                    if value is not None:
                        out.append({"category": cat, "label": categories[cat], "value": value, "year": 2021})
    unique = {x["category"]: x for x in out}
    return sorted(unique.values(), key=lambda x: -x["value"])


def normalize(text: str):
    value = unicodedata.normalize("NFKD", text.strip().upper())
    return "".join(c for c in value if not unicodedata.combining(c))


def rs_number(value: str) -> int | None:
    text = value.strip().replace("\u00a0", "").replace(" ", "")
    if not text:
        return None
    if not re.fullmatch(r"\d{1,3}(?:\.\d{3})*|\d+", text):
        return None
    return int(text.replace(".", ""))


def read_csv(raw: bytes) -> list[list[str]]:
    # Alguns arquivos da fonte declaram UTF-8, mas usam ISO-8859-1.
    try:
        body = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        body = raw.decode("latin-1")
    return list(csv.reader(io.StringIO(body)))


def parse_rs_csv(raw: bytes, year: int, group: str, url: str) -> list[dict]:
    rows = read_csv(raw)
    header_index = next((
        i for i, row in enumerate(rows)
        if any(normalize(v) in ("MES", "MESES") for v in row)
        and any(normalize(v) == "TOTAL" for v in row)
    ), None)
    if header_index is None:
        raise ValueError(f"Cabeçalho de mês e total não identificado: {url}")
    header = rows[header_index]
    total_idx = next(i for i, cell in enumerate(header) if normalize(cell) == "TOTAL")
    month_idx = next(i for i, cell in enumerate(header) if normalize(cell) in ("MES", "MESES"))
    result = []
    for row in rows[header_index + 1:]:
        if len(row) <= max(total_idx, month_idx):
            continue
        month = MONTHS.get(normalize(row[month_idx]).replace(".", "")[:3])
        if not month:
            continue
        # Ausência não equivale a zero. Alguns recursos têm linhas para
        # meses futuros com Total=0, mas demais colunas em branco.
        values = [rs_number(v) for i, v in enumerate(row)
                  if month_idx < i < total_idx]
        if not any(v is not None for v in values):
            continue
        total = rs_number(row[total_idx])
        if total is None:
            continue
        result.append({
            "month": f"{year}-{month:02d}", "value": total,
            "group": group, "territory": "43", "sourceUrl": url,
        })
    return result


def collect_rs(group: str, slug: str) -> list[dict]:
    meta = get_json(PACKAGE + urllib.parse.quote(slug))
    if not meta.get("success"):
        raise ValueError(f"Dataset CKAN inválido: {slug}")
    pkg = meta["result"]
    if pkg.get("license_id") != "CC0-1.0":
        raise ValueError(f"Licença JUCISRS inesperada: {pkg.get('license_id')}")
    resources = []
    for entry in pkg.get("resources", []):
        text = " ".join((entry.get("name", ""), entry.get("description", "")))
        match = re.search(r"\b(20[0-9]{2})\b", text)
        if not match or int(match.group(1)) < 2023 or int(match.group(1)) > datetime.now().year:
            continue
        if entry.get("format", "").lower() != "csv":
            continue
        url = entry.get("url", "")
        if not url.startswith("https://dados.rs.gov.br/"):
            continue
        resources.append((int(match.group(1)), url))
    # Recursos de 2023 em diante, sem supor periodicidade completa.
    output = []
    for year, url in sorted(resources)[-2:]:
        output.extend(parse_rs_csv(download(url), year, group, url))
    return sorted(output, key=lambda x: x["month"])


def collect_boundary():
    geo = get_json(MALHA)
    features = geo.get("features", [])
    if geo.get("type") != "FeatureCollection" or not features:
        raise ValueError("Malha municipal IBGE inválida")
    if not all(f.get("properties", {}).get("codarea") == MUNICIPIO for f in features):
        raise ValueError("Malha não corresponde a Canoas")
    return geo


def collect() -> tuple[dict, dict | None]:
    data = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "municipality": {"code": MUNICIPIO, "name": "Canoas", "state": "RS"},
        "sources": [],
        "cempre": [],
        "cnae": [],
        "gdp": [],
        "population": [],
        "rsBusiness": [],
        "quality": {"status": "partial", "errors": [], "notes": [
            "O CEMPRE é anual e possui universo diferente do CNPJ. Série municipal da tabela 993 encerrada em 2021.",
            "Dados de registros JUCISRS são totais do estado do RS, não de Canoas.",
            "Não há pontos geocodificados de estabelecimentos; nenhum ponto é simulado.",
        ]},
    }

    def pull(label, call, store, source=None):
        try:
            value = call()
            if not value:
                raise ValueError("Fonte retornou conjunto vazio")
            data[store] = value
            if source:
                data["sources"].append(source)
            print(f"OK {label}: {len(value) if hasattr(value,'__len__') else '1'}", flush=True)
        except Exception as exc:
            msg = f"{label}: {exc}"
            data["quality"]["errors"].append(msg)
            print("AVISO", msg, flush=True)

    pull("IBGE CEMPRE Canoas", lambda: sidra_series(993, 2585, list(range(2016, 2022))),
         "cempre", {"name": "IBGE / CEMPRE - empresas e outras organizações",
                    "url": "https://sidra.ibge.gov.br/tabela/993", "reference": "2016–2021",
                    "territory": MUNICIPIO})
    pull("IBGE CNAE CEMPRE", sidra_sections, "cnae",
         {"name": "IBGE / CEMPRE - seções CNAE", "url": "https://sidra.ibge.gov.br/tabela/993",
          "reference": "2021", "territory": MUNICIPIO})
    pull("IBGE PIB Canoas", lambda: sidra_series(5938, 37, list(range(2018, 2024))),
         "gdp", {"name": "IBGE / PIB dos Municípios (mil R$)", "url": "https://sidra.ibge.gov.br/tabela/5938",
                 "reference": "2018–2023", "territory": MUNICIPIO})
    pull("IBGE Censo Canoas", lambda: sidra_series(4714, 93, [2022]),
         "population", {"name": "IBGE / Censo Demográfico 2022", "url": "https://sidra.ibge.gov.br/tabela/4714",
                        "reference": "2022", "territory": MUNICIPIO})

    for group, slug in RS_DATASETS.items():
        try:
            entries = collect_rs(group, slug)
            if entries:
                data["rsBusiness"].extend(entries)
                data["sources"].append({
                    "name": "JUCISRS / " + group.replace("_", " "),
                    "url": "https://dados.rs.gov.br/dataset/" + slug,
                    "reference": "2023–2026 conforme arquivos",
                    "territory": "43",
                })
                print(f"OK JUCISRS {group}: {len(entries)} meses", flush=True)
            else:
                data["quality"]["errors"].append(f"JUCISRS {group}: nenhuma observação válida")
        except Exception as exc:
            data["quality"]["errors"].append(f"JUCISRS {group}: {exc}")
            print(f"AVISO JUCISRS {group}: {exc}", flush=True)

    boundary = None
    try:
        boundary = collect_boundary()
        print("OK malha IBGE 4304606", flush=True)
    except Exception as exc:
        data["quality"]["errors"].append(f"Malha IBGE: {exc}")
    data["quality"]["status"] = (
        "ok" if not data["quality"]["errors"] else
        "partial" if any((data["cempre"], data["gdp"], data["rsBusiness"], data["population"])) else
        "unavailable"
    )
    return data, boundary


def main() -> int:
    data, geo = collect()
    PUBLIC.mkdir(parents=True, exist_ok=True)
    (PUBLIC / "official.json").write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
    )
    if geo:
        (PUBLIC / "canoas.geojson").write_text(
            json.dumps(geo, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
        )
    print("RESUMO", json.dumps({
        "status": data["quality"]["status"],
        "municipio": MUNICIPIO,
        "cempre": data["cempre"],
        "gdp": data["gdp"],
        "population": data["population"],
        "cnae_sections": len(data["cnae"]),
        "rs_months": len(data["rsBusiness"]),
        "errors": data["quality"]["errors"],
    }, ensure_ascii=False), flush=True)
    # Não aceitar site sem nenhum indicador municipal real.
    if not (data["cempre"] or data["gdp"] or data["population"]):
        print("ERRO: sem qualquer indicador municipal auditável", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
