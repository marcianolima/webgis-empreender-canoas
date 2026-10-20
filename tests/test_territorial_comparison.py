"""Reconcile the official territorial universes for the comparative choropleth.

No CNPJ geocoding is inferred: the RFB dimension uses declared bairro names,
while CNEFE observations are assigned with their observed coordinates.
"""
import json
import unittest
import unicodedata
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "public" / "data"


def normalize(name):
    return "".join(ch for ch in unicodedata.normalize("NFD", name.upper())
                   if not unicodedata.combining(ch)).strip()


class TerritorialComparisonIntegrity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bairros = json.loads((DATA / "bairros-economia.json").read_text(encoding="utf-8"))
        cls.hex = json.loads((DATA / "cnefe-hex500.json").read_text(encoding="utf-8"))

    def test_territorial_alignment(self):
        a = self.bairros
        b = self.hex
        self.assertEqual(a["territory"], b["territory"])
        self.assertEqual(a["territory"], "4304606")
        self.assertEqual(a["status"], b["status"])
        self.assertEqual(a["status"], "verified")
        self.assertEqual(b["spatialOverlayVersion"], 1)
        left = {normalize(x["name"]): x for x in a["neighborhoods"]}
        right = {normalize(x["bairro"]): x for x in b["spatialTopology"]["neighborhoods"]}
        self.assertEqual(len(left), len(right))
        self.assertEqual(len(left), 18)
        self.assertEqual(left.keys(), right.keys())
        for key in left:
            self.assertAlmostEqual(left[key]["areaKm2"], right[key]["areaKm2"], delta=max(.005, left[key]["areaKm2"]*.002))

    def test_no_zero_imputation_or_invented_counts(self):
        for item in self.hex["spatialTopology"]["neighborhoods"]:
            total = item["observedAddresses"]
            high = item["highQualityAddresses"]
            self.assertTrue(total is None or (type(total) is int and (total == 0 or total >= 5)))
            self.assertTrue(high is None or (type(high) is int and (high == 0 or high >= 5)))
            if total is not None and high is not None:
                self.assertLessEqual(high, total)
            self.assertGreater(item["areaKm2"], 0)

    def test_different_source_universes_not_merged(self):
        self.assertEqual(self.hex["reference"], "CNEFE 2022")
        self.assertRegex(self.bairros["reference"], r"^20\d\d-\d\d$")
        self.assertEqual(
            self.bairros["coverage"]["matched"],
            sum(r["active"] or 0 for r in self.bairros["neighborhoods"])
        )
        # Independently classified observed CNEFE points, not enterprise
        # counts. The suppressed 1–4 values cannot be silently zero-filled.
        observed = sum(r["observedAddresses"] or 0 for r in self.hex["spatialTopology"]["neighborhoods"])
        self.assertGreater(observed, 0)
        self.assertNotEqual(observed, self.bairros["coverage"]["matched"])

    def test_official_topology_and_privacy(self):
        topo = self.hex["spatialTopology"]
        self.assertEqual(
            topo["fullyContainedHexagons"] + topo["crossBorderHexagons"],
            self.hex["coverage"]["gridCells"],
        )
        self.assertEqual(len(topo["neighborhoods"]), 18)
        self.assertFalse(self.hex["privacy"]["individualCoordinatesPublished"])
        self.assertGreater(topo["fragments"], topo["fullyContainedHexagons"])
        self.assertIn("bairros", self.bairros["pmtiles"]["layer"])


if __name__ == "__main__":
    unittest.main()
