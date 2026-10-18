#!/usr/bin/env python3
"""Valida CSV agregado de fontes públicas e publica JSON leve para o dashboard.

NÃO faz raspagem de Power BI nem consulta a endpoints privados.
Somente importar arquivos obtidos por via legítima e revisados.
Uso: python scripts/import_external_indicators.py --input arquivos/extraidos.csv
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

FIELDS = [
    "fonte", "indicador", "competencia", "territorio", "valor",
    "unidade", "universo", "segmento", "extraido_em", "url_origem", "metodologia",
]
ALLOWED_SOURCES = {
    "datasebrae_aberturas": ("datasebrae.com.br",),
    "datasebrae_tempo": ("datasebrae.com.br",),
    "rs_em_dados": ("rsemdados.com.br", "investrs.org.br", "desenvolvimento.rs.gov.br"),
    "mapa_empresas": ("gov.br", "estatistica.redesim.gov.br"),
    "dados_rs": ("dados.rs.gov.br", "data.rs.gov.br", "dados.rs.gov.br"),
}
ALLOWED_METRICS = {
    "datasebrae_aberturas": {"aberturas", "baixas", "ativas"},
    "datasebrae_tempo": {
        "tempo_abertura_horas", "tempo_viabilidade_horas", "tempo_registro_horas",
    },
    "rs_em_dados": {
        "aberturas", "baixas", "ativas", "pib_brl",
        "empregos_formais", "exportacoes_usd",
    },
    "mapa_empresas": {
        "aberturas", "baixas", "ativas",
        "tempo_abertura_horas", "tempo_viabilidade_horas", "tempo_registro_horas",
    },
    "dados_rs": {
        "aberturas", "baixas", "ativas", "pib_brl",
        "empregos_formais", "exportacoes_usd",
    },
}
METRIC_UNITS = {
    "aberturas": {"empresas", "estabelecimentos"},
    "baixas": {"empresas", "estabelecimentos"},
    "ativas": {"empresas", "estabelecimentos"},
    "tempo_abertura_horas": {"horas"},
    "tempo_viabilidade_horas": {"horas"},
    "tempo_registro_horas": {"horas"},
    "pib_brl": {"BRL"},
    "empregos_formais": {"vinculos"},
    "exportacoes_usd": {"USD"},
}
TERRITORIES = {"4304606", "43"}


def parse_number(raw: str) -> float | int:
    value = raw.strip().replace(" ", "")
    if re.fullmatch(r"[+-]?\d{1,3}(?:\.\d{3})+(?:,\d+)?", value):
        value = value.replace(".", "").replace(",", ".")
    elif "," in value and "." not in value:
        value = value.replace(",", ".")
    if not re.fullmatch(r"[+-]?\d+(?:\.\d+)?", value):
        raise ValueError(f"Valor numérico inválido: {raw!r}")
    numeric = float(value)
    if not math.isfinite(numeric) or numeric < 0:
        raise ValueError(f"Valor deve ser finito e não negativo: {raw!r}")
    if numeric.is_integer():
        return int(numeric)
    return numeric


def has_domain(url: str, domains: tuple[str, ...]) -> bool:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    return parsed.scheme == "https" and bool(host) and any(
        host == domain or host.endswith("." + domain) for domain in domains
    )


def parse_row(data: dict[str, str], number: int) -> dict:
    required = [key for key in FIELDS if key != "segmento"]
    missing = [key for key in required if not (data.get(key) or "").strip()]
    if missing:
        raise ValueError(f"Linha {number}: campos obrigatórios vazios: {missing}")
    row = {name: (data.get(name) or "").strip() for name in FIELDS}
    source = row["fonte"]
    metric = row["indicador"]
    if source not in ALLOWED_SOURCES:
        raise ValueError(f"Linha {number}: fonte não cadastrada: {source}")
    if metric not in ALLOWED_METRICS[source]:
        raise ValueError(f"Linha {number}: indicador {metric} incompatível com {source}")
    if row["territorio"] not in TERRITORIES:
        raise ValueError(f"Linha {number}: território precisa ser 4304606 (Canoas) ou 43 (RS)")
    if not re.fullmatch(r"\d{4}(-(0[1-9]|1[0-2]))?", row["competencia"]):
        raise ValueError(f"Linha {number}: competência exige AAAA ou AAAA-MM")
    if row["unidade"] not in METRIC_UNITS[metric]:
        raise ValueError(f"Linha {number}: unidade incompatível com {metric}")
    try:
        date.fromisoformat(row["extraido_em"])
    except ValueError as exc:
        raise ValueError(f"Linha {number}: extraido_em precisa ser AAAA-MM-DD") from exc
    if not has_domain(row["url_origem"], ALLOWED_SOURCES[source]):
        raise ValueError(f"Linha {number}: URL de origem inválida para a fonte")
    row["valor"] = parse_number(row["valor"])
    if row["unidade"] != "horas" and row["valor"] != int(row["valor"]):
        if row["unidade"] not in {"BRL", "USD"}:
            raise ValueError(f"Linha {number}: indicador de contagem exige inteiro")
    return row


def read_csv(path: Path) -> list[dict]:
    if not path.is_file():
        raise ValueError(f"CSV não encontrado: {path}")
    text = path.read_text(encoding="utf-8-sig")
    first_line = text.splitlines()[0] if text.splitlines() else ""
    delimiter = ";" if ";" in first_line else ","
    reader = csv.DictReader(io.StringIO(text, newline=""), delimiter=delimiter)
    if reader.fieldnames is None or set(FIELDS) - set(reader.fieldnames):
        raise ValueError("O arquivo deve incluir todas as colunas do modelo, incluindo segmento.")
    records = []
    for i, data in enumerate(reader, start=2):
        if None in data:
            raise ValueError(f"Linha {i}: colunas extras inesperadas (verifique separador)")
        records.append(parse_row(data, i))
    if not records:
        raise ValueError("CSV sem linhas de indicadores; não há dados para importar.")
    return records


def record_key(row: dict) -> tuple:
    return tuple(row[k] for k in (
        "fonte", "indicador", "competencia", "territorio",
        "universo", "segmento",
    ))


def run(path: Path, output: Path, append: bool) -> dict:
    imported = read_csv(path)
    seen = set()
    for row in imported:
        key = record_key(row)
        if key in seen:
            raise ValueError(f"Registros duplicados no arquivo: {key}")
        seen.add(key)
    existing: list[dict] = []
    if append and output.exists():
        previous = json.loads(output.read_text(encoding="utf-8"))
        if previous.get("schema_version") != 1:
            raise ValueError("Formato anterior incompatível.")
        existing = previous["records"]
    merged = {record_key(row): row for row in existing}
    merged.update({record_key(row): row for row in imported})
    final = sorted(merged.values(), key=lambda r: (
        r["fonte"], r["indicador"], r["territorio"], r["universo"],
        r["segmento"], r["competencia"],
    ))
    document = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "input_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "records": final,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"importadas": len(imported), "publicadas": len(final), "saida": str(output)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="CSV agregado e revisado (ver docs/modelo-indicadores-externos.csv)")
    parser.add_argument("--output", type=Path, default=Path("src/data/external-indicators.json"))
    parser.add_argument("--append", action="store_true", help="Manter outras competências/fontes e substituir apenas mesmas chaves")
    args = parser.parse_args()
    try:
        print(json.dumps(run(args.input, args.output, args.append), ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError, json.JSONDecodeError, KeyError) as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
