import sys
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from collect_official import numeric, rs_number, parse_rs_csv

class CollectorTests(unittest.TestCase):
    def test_ibge_missing_is_not_zero(self):
        self.assertIsNone(numeric("..."))
        self.assertIsNone(numeric("-"))
        self.assertEqual(numeric("12555"), 12555)

    def test_jucisrs_local_month_and_future_blank(self):
        # Somente fixture de parser, nunca importada como estatística publicada.
        csv = ",2025,,,,\n,Mês,MEI,LTDA,Total\n,Jan,15,4,19\n,Fev,,,0\n,Tot.,15,4,19\n"
        rows = parse_rs_csv(csv.encode("utf-8"), 2025, "constituidas", "https://dados.rs.gov.br/exemplo")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["month"], "2025-01")
        self.assertEqual(rows[0]["territory"], "43")
        self.assertEqual(rs_number("1.234"), 1234)

if __name__ == "__main__":
    unittest.main()
