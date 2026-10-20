"""Integrity tests of filtered IBGE 2022 Canoas sectors and PMTiles artifacts."""
import hashlib
import json
import unittest
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "public" / "data"


class TestCenso2022Setores(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (DATA / "censo2022-setores.json").exists():
            raise unittest.SkipTest("Initial official ETL not yet published (workflow handles import)")
        cls.data = json.loads((DATA / "censo2022-setores.json").read_text(encoding="utf-8"))
        cls.overlap = json.loads((DATA / "censo2022-setores-bairros.json").read_text(encoding="utf-8"))
        cls.geo = json.loads((DATA / "censo2022-setores.geojson").read_text(encoding="utf-8"))

    def test_official_municipal_universe(self):
        d=self.data
        self.assertEqual(d["status"], "verified")
        self.assertEqual(d["territory"], "4304606")
        self.assertEqual(d["referenceYear"], 2022)
        self.assertEqual(d["populationSumReported"], 347657)
        self.assertEqual(d["sectorCount"], 659)
        self.assertEqual(len(d["sectors"]), len(self.geo["features"]))
        self.assertEqual(len({s["id"] for s in d["sectors"]}), d["sectorCount"])
        self.assertTrue(all(s["id"].startswith("4304606") and len(s["id"])==15 for s in d["sectors"]))

    def test_shape_semantics_and_source_provenance(self):
        self.assertEqual(self.geo["type"], "FeatureCollection")
        self.assertEqual(self.geo["features"][0]["geometry"]["type"] in ("Polygon","MultiPolygon"), True)
        self.assertEqual({f["properties"]["id"] for f in self.geo["features"]},
                         {s["id"] for s in self.data["sectors"]})
        self.assertGreater(len(self.data["dictionary"]), 75)
        self.assertIn("basico", self.data["sourceAggregates"])
        self.assertIn("demografia", self.data["sourceAggregates"])
        self.assertIn("domicilio", self.data["sourceAggregates"])
        self.assertIn("renda", self.data["sourceAggregates"])
        for fingerprint in self.data["sourceSha256"].values():
            self.assertEqual(len(fingerprint), 64)

    def test_no_imputation_or_fabricated_microdata(self):
        self.assertTrue(self.data["privacy"]["withheldValuesKeptNull"])
        self.assertFalse(self.data["privacy"]["individualCoordinatesPublished"])
        total = sum(s["metrics"]["pop"] for s in self.data["sectors"]
                    if s["metrics"]["pop"] is not None)
        self.assertEqual(total, 347657)
        for s in self.data["sectors"]:
            m=s["metrics"]
            self.assertGreater(m["area_km2"],0)
            self.assertEqual(len(s["centroid"]),2)
            if m.get("masculino") is not None and m.get("feminino") is not None and m.get("pop") is not None:
                self.assertAlmostEqual(m["masculino"] + m["feminino"], m["pop"], delta=5)
            if m.get("dens_pop") is not None:
                self.assertAlmostEqual(m["dens_pop"],m["pop"]/m["area_km2"],delta=max(2,m["dens_pop"]*.005))
            if m.get("perc_vagos") is not None:
                self.assertTrue(0<=m["perc_vagos"]<=100)

    def test_topological_bairro_crosswalk(self):
        ov=self.overlap
        self.assertTrue(ov["modelled"])
        self.assertEqual(ov["territory"],"4304606")
        self.assertEqual(len(ov["neighborhoods"]),18)
        self.assertEqual(len(ov["sectors"]),659)
        self.assertEqual(len({s["id"] for s in ov["sectors"]}),659)
        self.assertTrue(any(s["crossBoundary"] for s in ov["sectors"]))
        self.assertTrue(all(0<=s["dominantAreaPercent"]<=100 for s in ov["sectors"]))
        for district in ov["neighborhoods"]:
            self.assertGreater(district["areaKm2"],.01)
            self.assertLessEqual(district["fullyContained"],district["sectorCount"])
            self.assertLessEqual(district["crossBoundary"],district["sectorCount"])
            self.assertLessEqual(district["fullyContainedPop"],district["populationArealEstimate"]+5000)

    def test_real_pmtiles_sha_and_geometry_count(self):
        tile=DATA/"censo2022-setores.pmtiles"
        blob=tile.read_bytes()
        self.assertEqual(blob[:8], b"PMTiles\x03")
        self.assertEqual(self.data["pmtiles"]["bytes"],len(blob))
        self.assertEqual(hashlib.sha256(blob).hexdigest(),self.data["pmtiles"]["sha256"])
        self.assertEqual(self.data["pmtiles"]["layers"],["setores"])
        self.assertLess(len(blob),30_000_000)


if __name__ == "__main__":
    unittest.main()
