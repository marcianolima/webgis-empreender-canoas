import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"


def contains(point, ring):
    x, y = point
    inside = False
    for i in range(len(ring)):
        a = ring[i]
        b = ring[i - 1]
        if (a[1] > y) != (b[1] > y):
            intersection = (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]
            if x < intersection:
                inside = not inside
    return inside


class NeighborhoodLabelsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.polygons = json.loads((DATA / "bairros-oficiais.geojson").read_text(encoding="utf-8"))
        cls.labels = json.loads((DATA / "bairros-rotulos.geojson").read_text(encoding="utf-8"))

    def test_exactly_one_point_label_per_official_neighborhood(self):
        names = {f["properties"]["BAIRRO"] for f in self.polygons["features"]}
        labels = self.labels["features"]
        self.assertEqual(len(names), 18)
        self.assertEqual(len(labels), 18)
        self.assertEqual({f["properties"]["bairro"] for f in labels}, names)
        self.assertTrue(all(f["geometry"]["type"] == "Point" for f in labels))

    def test_labels_reside_inside_official_polygon(self):
        official = {f["properties"]["BAIRRO"]: f["geometry"] for f in self.polygons["features"]}
        for f in self.labels["features"]:
            with self.subTest(neighborhood=f["properties"]["bairro"]):
                polygon = official[f["properties"]["bairro"]]
                self.assertEqual(polygon["type"], "Polygon")
                rings = polygon["coordinates"]
                point = f["geometry"]["coordinates"]
                self.assertTrue(contains(point, rings[0]), "Label outside official polygon")
                self.assertTrue(all(not contains(point, hole) for hole in rings[1:]), "Label in polygon hole")

    def test_no_individual_company_or_address_coordinates(self):
        self.assertEqual(len(self.labels["features"]), 18)
        for f in self.labels["features"]:
            self.assertSetEqual(set(f["properties"]), {"bairro", "oid"})


if __name__ == "__main__":
    unittest.main()
