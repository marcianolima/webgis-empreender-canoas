#!/usr/bin/env python3
"""Recorta um lote mensal oficial de Dados Abertos CNPJ para Canoas/RS.

Somente bibliotecas da instalação padrão de Python. Aceita arquivos ZIP e CSV
no leiaute oficial da Receita (sem cabeçalhos; separado por ponto e vírgula).
Apenas produz CSV local e relatório: não geocodifica nem publica dados.
"""
from __future__ import annotations

import argparse
import csv
import glob
import io
import json
import re
import sqlite3
import sys
import tempfile
import unicodedata
import zipfile
from collections import Counter
from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Iterator


def normalize(value: str) -> str:
    text = unicodedata.normalize("NFKD", value.strip().upper())
    return "".join(c for c in text if not unicodedata.combining(c))


def input_paths(patterns: list[str] | None) -> list[Path]:
    paths: list[Path] = []
    for pattern in patterns or []:
        matches = [Path(name) for name in glob.glob(pattern)]
        if not matches and Path(pattern).is_file():
            matches = [Path(pattern)]
        if not matches:
            raise ValueError(f"Arquivo ou padrão não encontrado: {pattern}")
        paths.extend(matches)
    paths = sorted(set(paths))
    if any(not path.is_file() for path in paths):
        raise ValueError("A entrada deve conter apenas arquivos.")
    return paths


@contextmanager
def cnpj_reader(path: Path) -> Iterator[csv.reader]:
    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as package:
            entries = [e for e in package.infolist() if not e.is_dir() and
                       not e.filename.startswith("__MACOSX/")]
            if not entries:
                raise ValueError(f"ZIP sem arquivo de dados: {path}")
            item = max(entries, key=lambda x: x.file_size)
            with package.open(item) as stream:
                with io.TextIOWrapper(stream, encoding="latin-1", newline="") as text:
                    yield csv.reader(text, delimiter=";", quotechar='"')
    else:
        with path.open("r", encoding="latin-1", newline="") as text:
            yield csv.reader(text, delimiter=";", quotechar='"')


def rows_from(paths: list[Path]) -> Iterator[list[str]]:
    for path in paths:
        print(f"[leitura] {path.name}", file=sys.stderr)
        with cnpj_reader(path) as reader:
            yield from reader


def municipality_code(path: Path) -> str:
    codes = set()
    for row in rows_from([path]):
        if len(row) >= 2 and normalize(row[1]) == "CANOAS":
            codes.add(row[0].strip())
    if len(codes) != 1:
        raise ValueError(
            "Não foi possível determinar unicamente o código RFB para CANOAS "
            f"na tabela Municipios: {sorted(codes)}"
        )
    return codes.pop()


def to_iso(raw: str) -> str:
    value = raw.strip()
    if not value or value == "00000000":
        return ""
    try:
        return date.fromisoformat(f"{value[:4]}-{value[4:6]}-{value[6:8]}").isoformat()
    except (ValueError, IndexError):
        return ""


def batched_insert(connection: sqlite3.Connection, sql: str, batch: list[tuple]):
    if batch:
        connection.executemany(sql, batch)
        connection.commit()
        batch.clear()


def run(args: argparse.Namespace) -> dict:
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", args.referencia):
        raise ValueError("A referência deve estar no formato AAAA-MM.")
    establishments = input_paths(args.estabelecimentos)
    companies = input_paths(args.empresas)
    simples = input_paths([args.simples] if args.simples else [])
    municipio_paths = input_paths([args.municipios] if args.municipios else [])
    if args.codigo_municipio:
        code = str(args.codigo_municipio).strip()
    elif municipio_paths:
        code = municipality_code(municipio_paths[0])
    else:
        raise ValueError("Forneça --municipios ou --codigo-municipio (código RFB).")
    if not code:
        raise ValueError("Código de município vazio.")

    args.saida.parent.mkdir(parents=True, exist_ok=True)
    counted = Counter()
    basics: set[str] = set()
    with tempfile.TemporaryDirectory(prefix="cnpj_canoas_") as temp:
        connection = sqlite3.connect(Path(temp) / "local.sqlite")
        try:
            connection.execute("""
                CREATE TABLE establishment (
                    cnpj TEXT PRIMARY KEY,
                    basico TEXT NOT NULL,
                    fantasia TEXT, situacao TEXT, data_situacao TEXT,
                    inicio TEXT, cnae TEXT, tipo_logradouro TEXT,
                    logradouro TEXT, numero TEXT, complemento TEXT,
                    bairro TEXT, cep TEXT, municipio_codigo TEXT, uf TEXT,
                    razao_social TEXT DEFAULT '', porte TEXT DEFAULT '',
                    simples TEXT DEFAULT '', mei TEXT DEFAULT ''
                )""")
            connection.execute("CREATE INDEX basic_idx ON establishment (basico)")
            insert = """INSERT OR IGNORE INTO establishment
                (cnpj,basico,fantasia,situacao,data_situacao,inicio,cnae,
                 tipo_logradouro,logradouro,numero,complemento,bairro,cep,
                 municipio_codigo,uf) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"""
            batch: list[tuple] = []
            for row in rows_from(establishments):
                counted["estabelecimentos_lidos"] += 1
                if len(row) < 21:
                    counted["estabelecimentos_malformados"] += 1
                    continue
                if row[19].strip().upper() != "RS" or row[20].strip() != code:
                    continue
                basico = row[0].strip().upper().zfill(8)
                cnpj = basico + row[1].strip().upper().zfill(4) + row[2].strip().upper().zfill(2)
                basics.add(basico)
                batch.append((
                    cnpj, basico, row[4].strip(), row[5].strip().zfill(2),
                    to_iso(row[6]), to_iso(row[10]), row[11].strip(),
                    row[13].strip(), row[14].strip(), row[15].strip(),
                    row[16].strip(), row[17].strip(), row[18].strip(),
                    row[20].strip(), row[19].strip()
                ))
                if len(batch) >= 3000:
                    batched_insert(connection, insert, batch)
            batched_insert(connection, insert, batch)
            counted["estabelecimentos_canoas"] = connection.execute(
                "SELECT COUNT(*) FROM establishment"
            ).fetchone()[0]
            if not counted["estabelecimentos_canoas"]:
                raise ValueError(
                    "Nenhum estabelecimento encontrado para Canoas. Verifique "
                    "competência, arquivos, UF e código municipal RFB."
                )

            batch = []
            update_companies = """UPDATE establishment
                SET razao_social = ?, porte = ? WHERE basico = ?"""
            for row in rows_from(companies):
                counted["empresas_lidas"] += 1
                if len(row) < 6:
                    counted["empresas_malformadas"] += 1
                    continue
                basico = row[0].strip().upper().zfill(8)
                if basico in basics:
                    batch.append((row[1].strip(), row[5].strip().zfill(2), basico))
                    if len(batch) >= 1000:
                        batched_insert(connection, update_companies, batch)
            batched_insert(connection, update_companies, batch)

            if simples:
                batch = []
                update_simples = """UPDATE establishment
                    SET simples = ?, mei = ? WHERE basico = ?"""
                for row in rows_from(simples):
                    counted["simples_lidos"] += 1
                    if len(row) < 5:
                        counted["simples_malformados"] += 1
                        continue
                    basico = row[0].strip().upper().zfill(8)
                    if basico in basics:
                        batch.append((row[1].strip(), row[4].strip(), basico))
                        if len(batch) >= 1000:
                            batched_insert(connection, update_simples, batch)
                batched_insert(connection, update_simples, batch)

            fields = [
                "cnpj", "basico", "razao_social", "fantasia", "situacao",
                "data_situacao", "inicio", "cnae", "porte", "simples",
                "mei", "tipo_logradouro", "logradouro", "numero",
                "complemento", "bairro", "cep", "municipio_codigo", "uf"
            ]
            query = "SELECT " + ",".join(fields) + " FROM establishment ORDER BY cnpj"
            with args.saida.open("w", newline="", encoding="utf-8") as output:
                writer = csv.writer(output)
                writer.writerow(fields)
                for row in connection.execute(query):
                    writer.writerow(row)
                    counted["registros_exportados"] += 1
                    counted["ativos"] += row[4] == "02"
                    counted["baixados"] += row[4] == "08"
                    counted["sem_razao_social"] += not bool(row[2])
                    counted["sem_inicio"] += not bool(row[6])
        finally:
            connection.close()

    report = {
        "fonte": "Receita Federal — Dados Abertos CNPJ",
        "territorio": "Canoas/RS",
        "codigo_municipio_rfb": code,
        "referencia_declarada": args.referencia,
        "processado_em_utc": datetime.now(timezone.utc).isoformat(),
        "estagio": "recorte local, não geocodificado, não homologado",
        "arquivos": {
            "estabelecimentos": [str(x) for x in establishments],
            "empresas": [str(x) for x in companies],
            "simples": [str(x) for x in simples],
            "municipios": [str(x) for x in municipio_paths],
        },
        "indicadores_qa": dict(counted),
        "geocodificacao": {
            "executada": False,
            "total_geocodificado": None,
            "taxa_sucesso": None,
            "observacao": "Não é correto tratar geocodificação não executada como taxa 0%.",
        },
        "alertas": [
            "A competência informada é declarativa; conferir o lote de origem.",
            "O recorte não reconstrói todos os eventos históricos cadastrais.",
            "MEI/Simples ficam desconhecidos quando o arquivo Simples não é fornecido.",
            "Não divulgar dados individualizados antes de revisão de privacidade.",
        ],
        "saida": str(args.saida),
    }
    meta = args.saida.with_name("metadata.json")
    meta.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--estabelecimentos", nargs="+", required=True, help="Todos os fragmentos ZIP/CSV de estabelecimentos")
    parser.add_argument("--empresas", nargs="+", required=True, help="Todos os fragmentos ZIP/CSV de empresas")
    parser.add_argument("--municipios", help="Arquivo ZIP/CSV de municípios da Receita Federal")
    parser.add_argument("--codigo-municipio", help="Código RFB, distinto do código IBGE")
    parser.add_argument("--simples", help="Arquivo ZIP/CSV de opção Simples/MEI")
    parser.add_argument("--referencia", required=True, help="Competência AAAA-MM do lote")
    parser.add_argument("--saida", type=Path, default=Path("data/processed/estabelecimentos_canoas.csv"))
    try:
        result = run(parser.parse_args())
        print(json.dumps({
            "saida": result["saida"],
            "registros_exportados": result["indicadores_qa"]["registros_exportados"],
            "ativos": result["indicadores_qa"]["ativos"],
            "alerta": "Ainda não há geocodificação nem homologação."
        }, ensure_ascii=False, indent=2))
        return 0
    except (ValueError, OSError, zipfile.BadZipFile, sqlite3.Error) as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
