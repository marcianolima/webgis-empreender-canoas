"""Testes locais de parser; não geram nem publicam empresas fictícias."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from cnpj_pipeline import section,iso,normalize,REF_PATTERN

class CnpjParserTests(unittest.TestCase):
    def test_section_cnae_divisions(self):
        self.assertEqual(section("4711301"),"G")
        self.assertEqual(section("8630503"),"Q")
        self.assertEqual(section("6201501"),"J")
        self.assertEqual(section("0000000"),"?")
    def test_dates(self):
        self.assertEqual(iso("20261018"),"2026-10-18")
        self.assertEqual(iso("00000000"),"")
        self.assertEqual(iso("20260230"),"")
    def test_normalization_and_reference(self):
        self.assertEqual(normalize(" São  Luís "), "SAO LUIS")
        self.assertTrue(REF_PATTERN.fullmatch("2026-10"))
        self.assertFalse(REF_PATTERN.fullmatch("2026-13"))
if __name__=="__main__":
    unittest.main()
