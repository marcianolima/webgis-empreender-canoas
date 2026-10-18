"""Validação de importações agregadas: entradas artificiais, nenhum dado real."""
import csv
import json
import tempfile
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from import_external_indicators import FIELDS, parse_row, run  # noqa: E402

BASE = {
    "fonte": "mapa_empresas",
    "indicador": "tempo_abertura_horas",
    "competencia": "2026-07",
    "territorio": "4304606",
    "valor": "20,5",
    "unidade": "horas",
    "universo": "Empresas nao MEI, registros concluidos",
    "segmento": "Total",
    "extraido_em": "2026-10-17",
    "url_origem": "https://www.gov.br/empresas-e-negocios/pt-br/mapa-de-empresas/painel-mapa-de-empresas",
    "metodologia": "Exportacao manual; filtro municipio Canoas/RS",
}


class ExternalIndicatorsTest(unittest.TestCase):
    def test_valid_values_and_domain(self):
        self.assertEqual(parse_row(BASE, 2)["valor"], 20.5)
        a = dict(BASE, url_origem="https://gov.br.attacker.example/invalid")
        with self.assertRaisesRegex(ValueError, "URL de origem"):
            parse_row(a, 2)
        b = dict(BASE, territorio="4305108")
        with self.assertRaisesRegex(ValueError, "território"):
            parse_row(b, 2)
        c = dict(BASE, unidade="empresas")
        with self.assertRaisesRegex(ValueError, "unidade"):
            parse_row(c, 2)

    def test_import_append_without_mixing(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            input_csv = root / "exemplo.csv"
            output = root / "external-indicators.json"
            with input_csv.open("w", encoding="utf-8", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=FIELDS, delimiter=";")
                writer.writeheader()
                writer.writerow(BASE)
            result = run(input_csv, output, append=False)
            self.assertEqual(result["publicadas"], 1)
            document = json.loads(output.read_text())
            self.assertEqual(document["records"][0]["valor"], 20.5)
            other = dict(BASE, competencia="2026-08", valor="21")
            with input_csv.open("w", encoding="utf-8", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=FIELDS, delimiter=";")
                writer.writeheader()
                writer.writerow(other)
            self.assertEqual(run(input_csv, output, append=True)["publicadas"], 2)

    def test_no_real_data_when_empty_csv(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            input_csv = root / "empty.csv"
            input_csv.write_text(";".join(FIELDS) + "\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "sem linhas"):
                run(input_csv, root / "out.json", append=False)

    def test_nonnegative_and_sources(self):
        with self.assertRaisesRegex(ValueError, "não negativo"):
            parse_row(dict(BASE, valor="-3"), 2)
        with self.assertRaisesRegex(ValueError, "incompatível"):
            parse_row(dict(BASE, fonte="datasebrae_aberturas"), 2)


if __name__ == "__main__":
    unittest.main()
