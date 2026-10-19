"""Audit published municipal IFDM (2013–2023) and IFGF (2013–2024) Firjan records.

Both editions 2025; no synthetic years, no extrapolations or invented rankings.
"""
import json
import unittest
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "public" / "data"


class TestFirjanOfficialRecords(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ifdm = json.loads((DATA / "ifdm-firjan.json").read_text(encoding="utf-8"))
        cls.ifgf = json.loads((DATA / "ifgf-firjan.json").read_text(encoding="utf-8"))

    def test_verified_source_and_municipality(self):
        for name, document in (("IFDM", self.ifdm), ("IFGF", self.ifgf)):
            with self.subTest(name=name):
                self.assertEqual(document["schemaVersion"], 1)
                self.assertEqual(document["status"], "verified")
                self.assertEqual(document["territory"], "4304606")
                self.assertEqual(document["sourceMunicipalityCode"], "430460")
                self.assertEqual(document["municipality"], "Canoas")
                self.assertEqual(document["state"], "RS")
                self.assertEqual(document["edition"], 2025)
                self.assertTrue(document["sourceUrl"].endswith(".xlsx"))
                self.assertTrue(document["sourceUrl"].startswith("https://"))

    def test_historic_range_not_invented(self):
        for document, end in ((self.ifdm, 2023), (self.ifgf, 2024)):
            series = document["series"]
            years = [row["year"] for row in series]
            self.assertEqual(years, list(range(2013, end + 1)))
            self.assertEqual(document["range"], {"start": 2013, "end": end, "count": len(years)})
            self.assertEqual(document["referenceYear"], end)

    def test_mean_and_component_bounds(self):
        for name, document, components in (
            ("IFDM", self.ifdm, ("employmentIncome", "education", "health")),
            ("IFGF", self.ifgf, ("autonomy", "personnel", "liquidity", "investment")),
        ):
            with self.subTest(index=name):
                for item in document["series"]:
                    values = item["values"]
                    self.assertEqual(set(values), set(components) | {"general"})
                    self.assertTrue(all(0 <= value <= 1 for value in values.values()))
                    self.assertAlmostEqual(values["general"], sum(values[k] for k in components) / len(components), delta=.00008)

    def test_latest_values_are_verified_publication(self):
        a, b = self.ifdm["series"][-1], self.ifgf["series"][-1]
        self.assertEqual(a["year"], 2023)
        self.assertEqual(a["values"], {
            "general": .7239, "education": .507, "health": .7703, "employmentIncome": .8944
        })
        self.assertEqual(a["ranking"]["general"], {"state": 144, "brazil": 1036})
        self.assertEqual(b["year"], 2024)
        self.assertEqual(b["values"], {
            "general": .6639, "autonomy": 1, "personnel": 1,
            "liquidity": .4072, "investment": .2485
        })
        self.assertNotIn("ranking", b)

    def test_rankings_are_not_inferred_for_ifgf(self):
        for p in self.ifdm["series"]:
            self.assertEqual(set(p["ranking"]), {"general", "education", "health", "employmentIncome"})
            for value in p["ranking"].values():
                self.assertGreater(value["state"], 0)
                self.assertGreater(value["brazil"], 0)
        for p in self.ifgf["series"]:
            self.assertEqual(set(p), {"year", "values"})


if __name__ == "__main__":
    unittest.main()
