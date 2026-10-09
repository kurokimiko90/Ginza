"""道路標記與寬度的資料轉換回歸測試。"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from build_city import collect, clip  # noqa: E402


def convert(tags):
    data = {"elements": [
        {"type": "node", "id": 1, "lat": 35.6712, "lon": 139.7655},
        {"type": "node", "id": 2, "lat": 35.6713, "lon": 139.7655},
        {"type": "way", "id": 3, "nodes": [1, 2], "tags": tags},
    ]}
    return collect(data)[1][0]


class RoadConversionTests(unittest.TestCase):
    def test_width(self):
        self.assertEqual(convert({"highway": "footway", "width": "3.5 m"})["width"], 3.5)
        self.assertEqual(convert({"highway": "footway", "width": "3.5 m"})["widthSource"], "osm")
        for width in ["0", "-2", "bad", "nan", "inf"]:
            with self.subTest(width=width):
                self.assertEqual(convert({"highway": "footway", "width": width})["width"], 2)
                self.assertEqual(convert({"highway": "footway", "width": width})["widthSource"], "estimated")

    def test_marked_crossing(self):
        for marking in [{"crossing": "zebra"}, {"crossing": "marked"}, {"crossing:markings": "yes"}]:
            road = convert({"highway": "footway", "footway": "crossing", **marking})
            self.assertTrue(road["crossing"])
            self.assertTrue(road["marked"])

    def test_unknown_marking_is_not_inferred(self):
        road = convert({"highway": "footway", "footway": "crossing", "crossing": "traffic_signals"})
        self.assertTrue(road["crossing"])
        self.assertFalse(road["marked"])
        self.assertNotIn("crossing", convert({"highway": "footway"}))

    def test_clip_preserves_metadata(self):
        road = {"kind": "footway", "width": 3.5, "widthSource": "osm", "crossing": True, "marked": True,
                "points": [[-20, 0], [0, 0], [5, 0], [20, 0]]}
        result = clip([], [road], [-10, -10, 10, 10])[1][0]
        self.assertEqual(result["points"], [[0, 0], [5, 0]])
        self.assertEqual(result["widthSource"], "osm")
        self.assertEqual({k: result[k] for k in ["width", "crossing", "marked"]},
                         {"width": 3.5, "crossing": True, "marked": True})


if __name__ == "__main__":
    unittest.main()
