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
        header='"Município","ibge","Emprego/2022 em diante/Total 2022 (-)","Emprego/2022 em diante/Total 2023 (-)"'
        lines=[header]
        for n in range(450):
            code = "4304606" if n==0 else str(9000000+n)
            lines.append('"Test","'+code+'","1.300","1.700"')
        result,n=extract_csv("\n".join(lines),"vinculos_formais",SOURCES["vinculos_formais"])
        self.assertEqual(n,450)
        self.assertEqual(result[0]["territory"],"4304606")
        self.assertEqual([v["year"] for v in result],[2022,2023])
        self.assertEqual([v["value"] for v in result],[1300,1700])
if __name__=="__main__":
    unittest.main()
