"""Offline geocoding invariants and Receita field layout regression."""
from __future__ import annotations
import importlib.util
import json
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))

class TestReceiptLayout(unittest.TestCase):
    def test_2018_plus_receita_field_dates_are_not_reversed(self):
        src=(ROOT/"scripts/cnpj_pipeline.py").read_text(encoding="utf-8")
        self.assertIn("iso(row[10]), iso(row[6]), row[11].strip()",src)
        self.assertNotIn("iso(row[6]), iso(row[10]), row[11].strip()",src)
    def test_no_raw_public_pii_in_geocoding_contract(self):
        src=(ROOT/"scripts/cnpj_geo.py").read_text(encoding="utf-8")
        self.assertIn("individualCoordinatesPublished",src)
        self.assertIn("minPublishedHexCount",src)
        self.assertIn("if count<5:continue",src)

@unittest.skipUnless(importlib.util.find_spec("shapely") and importlib.util.find_spec("pyproj"),
    "CNPJ geocoding requires spatial libraries in the GIS Actions runner")
class TestGeocodingWithSpatialLibraries(unittest.TestCase):
    def test_street_names_and_address_numbers(self):
        import cnpj_geo
        self.assertEqual(cnpj_geo.street("R","DOUTOR BARCELOS"),"RUA DOUTOR BARCELOS")
        self.assertEqual(cnpj_geo.street("RUA","RUA SANTA ROSA"),"RUA SANTA ROSA")
        self.assertEqual(cnpj_geo.street("AV.","GETULIO VARGAS"),"AVENIDA GETULIO VARGAS")
        self.assertEqual(cnpj_geo.street("RUA","São José"),"RUA SAO JOSE")
        self.assertEqual(cnpj_geo.cep("92025-400"),"92025400")
        self.assertEqual(cnpj_geo.number("00054"),"54")
        self.assertEqual(cnpj_geo.number("S/N"),"")
        self.assertEqual(cnpj_geo.number("54 A"),"")
        self.assertEqual(cnpj_geo.number(""),"")
    def test_archive_aggregates_and_privacy(self):
        import cnpj_geo
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory)
            (root/"cnpj.json").write_text(json.dumps({"reference":"2026-10","kpis":{"active":1200}}))
            data={
               "reference":"2026-10","source":"RFB+IBGE_CNEFE2022",
               "active":120,"matched":60,"hasUsableAddress":100,
               "diagnostics":{"missing_address_components":20,"ambiguous_cnefe_geocodes":5,
                              "not_found_in_2022_cnefe":35,"exact_address_match":60},
               "cells":{"h100_200":45,"h100_201":10,"h100_202":3,"h100_203":2},
               "sectors":[{"cell":"h100_200","sector":"G","count":40},
                          {"cell":"h100_201","sector":"G","count":10},
                          {"cell":"h100_202","sector":"G","count":3}]}
            for index in range(10):
                (root/f"geo-part-{index}.json").write_text(json.dumps(dict(data,shard=index)))
            with patch.object(cnpj_geo,"DATA",root):
                cnpj_geo.assemble("2026-10",root)
            result=json.loads((root/"cnpj-geo-hex500.json").read_text())
            self.assertEqual(result["coverage"]["active"],1200)
            self.assertEqual(result["coverage"]["matched"],600)
            self.assertEqual(result["coverage"]["matchedInPublishedCells"],550)
            self.assertEqual(result["coverage"]["unpublishedBelowPrivacyThreshold"],50)
            self.assertEqual(len(result["cells"]),2)
            self.assertTrue(all(c["matched"]>=5 for c in result["cells"]))
            # Published sector G must have a complement >=5 in the same cell
            self.assertEqual(result["cells"][0]["sG"],400)
            self.assertNotIn("sG",result["cells"][1])
            self.assertFalse(result["privacy"]["individualCoordinatesPublished"])
            self.assertEqual(len(json.loads((root/"cnpj-geo-hex500-series.json").read_text())["snapshots"]),1)

if __name__=="__main__":unittest.main()
