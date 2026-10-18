"""Testes sem solicitar dados à rede ou publicar valores sintéticos."""
import json
import math
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
import collect_sebrae as sebrae
class TestSebrae(unittest.TestCase):
    def test_numeric_validation(self):
        self.assertEqual(sebrae.valid_num(5),5)
        self.assertRaises(ValueError,sebrae.valid_num,None)
        self.assertRaises(ValueError,sebrae.valid_num,float("nan"))
        self.assertRaises(ValueError,sebrae.valid_num,-5)
        self.assertRaises(ValueError,sebrae.valid_num,0)
    def test_territory_snapshot(self):
        source=json.loads(sebrae.ARCHIVE.read_text(encoding="utf-8"))
        self.assertEqual(source["municipalityIbgeCode"],"4304606")
        self.assertEqual(source["observedOn"],"2026-10-18")
        records=source["observations"]
        self.assertGreaterEqual(len(records),40)
        self.assertEqual(len(set(x["code"] for x in records)),len(records))
        self.assertTrue(all(x["sourceUrl"]==sebrae.URL for x in records))
        self.assertTrue(all(isinstance(x["value"],(float,int)) and math.isfinite(x["value"]) for x in records))
if __name__=="__main__":unittest.main()
