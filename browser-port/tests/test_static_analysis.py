import importlib.util
import unittest
from pathlib import Path

MODULE = Path(__file__).parents[1] / "tools" / "analyze_scm_dispatch.py"
spec = importlib.util.spec_from_file_location("scm_map", MODULE)
scm_map = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(scm_map)


class SCMStaticMapTests(unittest.TestCase):
    def test_direct_routes_group_shared_handlers(self):
        rows = scm_map.grouped_direct([0x1000, 0x2000, 0x1000], 0x64)
        self.assertEqual(rows, [
            {"handler_va": "0x00001000", "opcodes": [0x64, 0x66]},
            {"handler_va": "0x00002000", "opcodes": [0x65]},
        ])

    def test_real_executable_group_maps_and_thread_pool(self):
        exe = Path("/mnt/data/gta_sa.exe")
        if not exe.exists():
            self.skipTest("Supplied GTA SA executable not mounted")
        result = scm_map.extract(exe.read_bytes())
        self.assertEqual(len(result["top_level_groups"]), 27)
        self.assertEqual(result["group_2"]["opcode_count"], 0x54)
        self.assertEqual(result["group_2"]["unique_handler_count"], 30)
        threads = result["thread_records"]
        self.assertEqual(threads["record_stride_bytes"], 0xE0)
        self.assertEqual(threads["record_count"], 96)
        self.assertEqual(threads["default_name"], "noname")
        self.assertFalse(result["safety"]["target_executed"])
        self.assertFalse(result["safety"]["protected_sections_read"])


if __name__ == "__main__":
    unittest.main()
