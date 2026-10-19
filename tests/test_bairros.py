"""Offline safety checks; no manufactured data is published."""
import importlib.util, pathlib, sys, unittest
p=pathlib.Path(__file__).resolve().parents[1]/"scripts/collect_bairros.py"
spec=importlib.util.spec_from_file_location("collect_bairros",p)
module=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=module
spec.loader.exec_module(module)
class TestGeocanoasBairros(unittest.TestCase):
    def test_orthographic_aliases(self):
        official={"MATHIAS VELHO","NOSSA SENHORA DAS GRACAS","SAO LUIS","BRIGADEIRA","FATIMA"}
        self.assertEqual(module.canonical("Matias Velho",official),"MATHIAS VELHO")
        self.assertEqual(module.canonical("São Luís",official),"SAO LUIS")
        self.assertEqual(module.canonical("Sao Luiz",official),"SAO LUIS")
        self.assertEqual(module.canonical("N. Sra. das Graças",official),"NOSSA SENHORA DAS GRACAS")
        self.assertEqual(module.canonical("Bairro Fátima",official),"FATIMA")
    def test_ambiguous_subdivisions_not_automatically_joined(self):
        official={"MATHIAS VELHO","FATIMA","BRIGADEIRA","IGARA"}
        for value in ("VILA IGARA","VILA FERNANDES","BRIGADEIRO","CIDADE NOVA","2 DISTRITO",""):
            self.assertIsNone(module.canonical(value,official))
    def test_bounds_rejects_invented_locations(self):
        self.assertEqual(len(module.cleanup_z([-51.20,-29.90,0])),2)
        with self.assertRaises(ValueError):module.cleanup_z([-46.0,-23.0])
    def test_null_denominators(self):
        self.assertIsNone(module.safe_number(None))
        self.assertIsNone(module.safe_number(float("nan")))
        self.assertEqual(module.safe_number(0),0.0)

    @unittest.skipUnless(__import__("importlib").util.find_spec("shapely") is not None and __import__("importlib").util.find_spec("pyproj") is not None,"Geometric math requires shapely and pyproj installed in geospatial worker")
    def test_hex_grid_utm_width_and_stable_assignment(self):
        import importlib.util
        s=importlib.util.spec_from_file_location("collect_hex500",pathlib.Path(__file__).resolve().parents[1]/"scripts/collect_hex500.py")
        hexmodule=importlib.util.module_from_spec(s)
        s.loader.exec_module(hexmodule)
        RADIUS,SCALE,hexagon,index_of,center,safe_public=(hexmodule.RADIUS,hexmodule.SCALE,hexmodule.hexagon,hexmodule.index_of,hexmodule.center,hexmodule.safe_public)
        self.assertAlmostEqual(SCALE,500.0,places=5)
        self.assertAlmostEqual(RADIUS*3**.5,500.0,places=5)
        for i,j in ((965,15445),(966,15446)):
            neighbors=hexmodule.hex_neighbors(i,j)
            self.assertEqual(len(neighbors),6)
            for a,b in neighbors:
                self.assertIn((i,j),hexmodule.hex_neighbors(a,b))
                self.assertAlmostEqual(__import__("math").dist(center(i,j),center(a,b)),500,places=5)
        for i,j in ((950,15440),(970,15460),(960,15455)):
            x,y=center(i,j)
            self.assertEqual(index_of(x,y),(i,j))
            self.assertTrue(hexagon(i,j).covers(__import__("shapely.geometry",fromlist=["Point"]).Point(x,y)))
        self.assertIsNone(safe_public(3))
        self.assertEqual(safe_public(0),0)
        self.assertEqual(safe_public(5),5)
if __name__=="__main__":unittest.main()
