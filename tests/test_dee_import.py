"""Testes de validação de fonte. Fixtures exclusivas dos testes, não publicadas."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from collect_dee import extract_csv,number,SOURCES

class DeeParserTests(unittest.TestCase):
    def test_missing_not_zero(self):
        self.assertIsNone(number("-"))
        self.assertEqual(number("1.234.567"),1234567)
    def test_municipality_enforced(self):
        header='"Município","ibge","Emprego/Total 2022 (-)"'
        lines=[header]
        for n in range(450):
            code = "4304606" if n==0 else str(9000000+n)
            lines.append('"Test","'+code+'","1.300"')
        result,n=extract_csv("\n".join(lines),"vinculos_formais",SOURCES["vinculos_formais"])
        self.assertEqual(n,450)
        self.assertEqual(result[0]["territory"],"4304606")
        self.assertEqual(result[0]["value"],1300)
if __name__=="__main__":
    unittest.main()
