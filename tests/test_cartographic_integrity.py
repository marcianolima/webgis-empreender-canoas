"""Validate released cartographic aggregates without external services."""
import json
import pathlib
import unittest
D=pathlib.Path(__file__).resolve().parents[1]/"public"/"data"
class TestCartographicIntegrity(unittest.TestCase):
 def test_geometry_and_grid(self):
  grid=json.loads((D/"cnefe-hex500.json").read_text(encoding="utf-8"))
  bairros=json.loads((D/"bairros-oficiais.geojson").read_text(encoding="utf-8"))
  self.assertEqual(grid["territory"],"4304606")
  self.assertEqual(grid["cellWidthMeters"],500)
  self.assertEqual(len(bairros["features"]),18)
  self.assertEqual(grid["coverage"]["gridCells"],len(grid["cells"]))
  self.assertEqual(sum(grid["coverage"]["kindCounts"].values()),grid["coverage"]["nonResidentialWithCoordinatesInOfficialBairros"])
  self.assertEqual(sum(grid["coverage"]["geocodingLevelCounts"].values()),grid["coverage"]["nonResidentialWithCoordinatesInOfficialBairros"])
 def test_suppression_is_not_zero(self):
  grid=json.loads((D/"cnefe-hex500.json").read_text(encoding="utf-8"))
  cells=grid["cells"]
  self.assertTrue(any(c.get("n") is None for c in cells))
  self.assertTrue(any(c.get("n")==0 for c in cells))
  self.assertTrue(all(c.get("n") is None or c["n"]==0 or c["n"]>=5 for c in cells))
  self.assertFalse(grid["privacy"]["individualCoordinatesPublished"])
 def test_cnpj_reconciliation(self):
  geo=json.loads((D/"cnpj-geo-hex500.json").read_text(encoding="utf-8"))
  if geo.get("status")!="verified":self.skipTest("CNPJ spatial snapshot not yet available")
  cov=geo["coverage"]
  self.assertEqual(sum(c["matched"] for c in geo["cells"]),cov["matchedInPublishedCells"])
  self.assertEqual(cov["matched"]-cov["matchedInPublishedCells"],cov["unpublishedBelowPrivacyThreshold"])
  self.assertGreaterEqual(cov["active"],cov["matched"])
  self.assertTrue(all(c["matched"]>=5 for c in geo["cells"]))
  self.assertFalse(geo["privacy"]["individualCoordinatesPublished"])
 def test_topology_accounting_when_available(self):
  d=json.loads((D/"cnefe-hex500.json").read_text(encoding="utf-8"))
  topo=d.get("spatialTopology")
  if topo is None:
   self.skipTest("PMTiles topology pending regeneration by geospatial workflow")
  self.assertEqual(d["spatialOverlayVersion"],1)
  self.assertIn("hex_bairros",d["pmtiles"]["layers"])
  self.assertEqual(len(topo["neighborhoods"]),18)
  self.assertEqual(len(topo["fullCellBairro"]),topo["fullyContainedHexagons"])
  self.assertEqual(topo["fullyContainedHexagons"]+topo["crossBorderHexagons"],d["coverage"]["gridCells"])
  self.assertGreaterEqual(topo["fragments"],d["coverage"]["gridCells"])
  published=sum(r["observedAddresses"] or 0 for r in topo["neighborhoods"])
  missing=sum(r["observedAddresses"] is None for r in topo["neighborhoods"])
  located=d["coverage"]["nonResidentialWithCoordinatesInOfficialBairros"]-topo["unassignedCnefePointBoundary"]-topo["ambiguousCnefePointBoundary"]
  # Each suppressed neighborhood total hides 1–4 records, never replace by zero.
  self.assertLessEqual(published,located)
  self.assertLessEqual(located-published,missing*4)
if __name__=="__main__":unittest.main()
