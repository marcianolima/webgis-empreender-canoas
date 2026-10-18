"""Testes com amostras INVENTADAS; não exercitam dados reais da Receita."""
import csv
import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def zipped(path, rows):
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as package:
        content = "".join(";".join(str(x) for x in row) + "\n" for row in rows)
        package.writestr("fixture.csv", content.encode("latin-1"))


class TestIngest(unittest.TestCase):
    def test_recorte_canoas_and_join(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            establishment = [""] * 30
            establishment[0:3] = ["00000001", "0001", "00"]
            establishment[4] = "FANTASIA TESTE"
            establishment[5] = "02"
            establishment[10] = "20260301"
            establishment[11] = "4711301"
            establishment[14] = "RUA TESTE"
            establishment[15] = "10"
            establishment[17] = "CENTRO"
            establishment[19] = "RS"
            establishment[20] = "1234"
            other = establishment.copy()
            other[0] = "00000002"
            other[20] = "8888"
            zipped(root / "Estabelecimentos0.zip", [establishment, other])
            zipped(root / "Empresas0.zip", [
                ["00000001", "EMPRESA FICTICIA", "2062", "49", "1000,00", "01", ""],
                ["00000002", "OUTRA", "2062", "49", "1000,00", "03", ""],
            ])
            zipped(root / "Municipios.zip", [["1234", "CANOAS"], ["8888", "OUTRA"]])
            zipped(root / "Simples.zip", [["00000001", "S", "20260101", "", "S", "20260101", ""]])
            dest = root / "processed" / "estabelecimentos_canoas.csv"
            command = [
                sys.executable, str(ROOT / "scripts" / "ingest_cnpj.py"),
                "--estabelecimentos", str(root / "Estabelecimentos0.zip"),
                "--empresas", str(root / "Empresas0.zip"),
                "--municipios", str(root / "Municipios.zip"),
                "--simples", str(root / "Simples.zip"),
                "--referencia", "2026-09", "--saida", str(dest),
            ]
            proc = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(proc.returncode, 0, proc.stderr)
            with dest.open(encoding="utf-8", newline="") as f:
                output = list(csv.DictReader(f))
            self.assertEqual(len(output), 1)
            self.assertEqual(output[0]["razao_social"], "EMPRESA FICTICIA")
            self.assertEqual(output[0]["cnpj"], "00000001000100")
            self.assertEqual(output[0]["inicio"], "2026-03-01")
            self.assertEqual(output[0]["mei"], "S")
            metadata = json.loads((dest.parent / "metadata.json").read_text())
            self.assertEqual(metadata["indicadores_qa"]["ativos"], 1)
            self.assertIsNone(metadata["geocodificacao"]["taxa_sucesso"])

    def test_requires_municipality_code(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            zipped(root / "e.zip", [["a"]])
            zipped(root / "c.zip", [["b"]])
            result = subprocess.run([
                sys.executable, str(ROOT / "scripts" / "ingest_cnpj.py"),
                "--estabelecimentos", str(root / "e.zip"),
                "--empresas", str(root / "c.zip"),
                "--referencia", "2026-09",
            ], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("--municipios", result.stderr)


if __name__ == "__main__":
    unittest.main()
