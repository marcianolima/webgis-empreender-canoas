"""Sebrae public OLAP audits: no network, no artificial published figures."""
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
import collect_sebrae_series as c

class TestMunicipalOLAP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.specs=json.loads(c.CONFIG.read_text(encoding="utf-8"))["specifications"]

    def test_configuration_has_no_duplicate_opaque_queries(self):
        self.assertGreaterEqual(len(self.specs),70)
        self.assertEqual(len(self.specs),len({s["id"] for s in self.specs}))
        self.assertTrue(all(s["dimensions"] and s["cube"] and s["measures"] is not None for s in self.specs))
        self.assertTrue(all("Municipality" not in s["filters"] for s in self.specs))
        rais=next(s for s in self.specs if s["id"]=="rais-trabalho-anual")
        self.assertEqual(rais["filters"]["Active worker indicator"],"1")
        self.assertEqual(rais["cube"],"RAIS_workers")

    def test_reject_cube_without_municipality(self):
        cub={"RAIS_workers":{"dimensions":[{"hierarchies":[{"levels":[{"name":"Year"}]}]}],
             "measures":[{"name":"Workers"}]}}
        spec={"cube":"RAIS_workers","dimensions":["Year"],"measures":["Workers"],"filters":{}}
        self.assertEqual(c.get_spec(spec,cub)["status"],"unavailable")

    def test_suppress_small_cells_without_imputing_zero(self):
        cub={"RAIS_workers":{"dimensions":[{"hierarchies":[{"levels":[{"name":"Municipality"},{"name":"Year"},{"name":"Active worker indicator"}]}]}],
             "measures":[{"name":"Workers"}],"annotations":{"source_name":"RAIS"}}}
        spec={"cube":"RAIS_workers","dimensions":["Year"],"measures":["Workers"],
              "filters":{"Active worker indicator":"1"}}
        mock={"page":{"total":2},"columns":["Year","Workers"],
              "data":[{"Year":2024,"Workers":3},{"Year":2025,"Workers":95_355}]}
        with patch.object(c,"request",return_value=mock):
            result=c.get_spec(spec,cub)
        self.assertEqual(result["status"],"ok")
        self.assertEqual(result["suppressedSmallCells"],1)
        self.assertEqual(result["rowCount"],1)
        self.assertEqual(result["rows"][0]["Workers"],95355)
        self.assertNotIn({"Year":2024,"Workers":3},result["rows"])

    def test_actual_persisted_territory_and_temporal_validity(self):
        data=json.loads(c.OUTPUT.read_text(encoding="utf-8"))
        self.assertEqual(data["municipalityIbgeCode"],"4304606")
        if data["status"]=="not_loaded":
            return
        self.assertEqual(len(data["datasets"]),len(self.specs))
        self.assertGreaterEqual(data["coverage"]["available"],45)
        self.assertEqual(len(data["catalog"]),data["coverage"]["catalogCubes"])
        active=next(x for x in data["datasets"] if x["id"]=="rais-trabalho-anual")
        self.assertEqual(active["status"],"ok")
        self.assertEqual(next(r["Workers"] for r in active["rows"] if r["Year"]==2025),95355)
        self.assertTrue(all(d.get("rowCount",0)<=c.MAX_ROWS for d in data["datasets"]))
        self.assertEqual(len({d["id"] for d in data["datasets"]}),len(data["datasets"]))
        self.assertTrue(all(r["Year"]>=1990 for d in data["datasets"] for r in d.get("rows",[]) if "Year" in r))

if __name__=="__main__":unittest.main()
