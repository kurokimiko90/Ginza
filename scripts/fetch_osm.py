"""從 Overpass API 抓取銀座範圍的 OSM 建築與道路，存成 work/ginza_osm.json。"""
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

# 銀座一〜八丁目＋周邊（南, 西, 北, 東）
BBOX = (35.6650, 139.7590, 35.6775, 139.7720)
ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)
WORK = Path(__file__).resolve().parent.parent / "work"
OUT = WORK / "ginza_osm.json"
POI_OUT = WORK / "ginza_poi.json"


def build_query(bbox):
    b = ",".join(str(v) for v in bbox)
    return f"""[out:json][timeout:120];
(
  way["building"]({b});
  relation["building"]({b});
  way["building:part"]({b});
  way["highway"]({b});
);
out body;
>;
out skel qt;"""


def build_poi_query(bbox):
    """店家、餐廳、飯店等有名稱的點位，用來產生招牌。"""
    b = ",".join(str(v) for v in bbox)
    return f"""[out:json][timeout:120];
(
  node["shop"]["name"]({b});
  node["amenity"~"^(restaurant|cafe|bar|pub|fast_food|bank|pharmacy|ice_cream|cinema|theatre)$"]["name"]({b});
  node["tourism"~"^(hotel|gallery|museum)$"]["name"]({b});
);
out body;"""


def fetch(query):
    data = urllib.parse.urlencode({"data": query}).encode()
    last_error = None
    for url in ENDPOINTS:
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": "ginza-walk/0.1"})
            with urllib.request.urlopen(req, timeout=180) as resp:
                return json.loads(resp.read())
        except Exception as exc:  # 換下一個端點
            last_error = exc
            print(f"[warn] {url} 失敗：{exc}", file=sys.stderr)
    raise SystemExit(f"所有 Overpass 端點都失敗：{last_error}")


def save(query, out, skip_existing):
    if skip_existing and out.exists():
        print(f"略過（已存在）：{out}")
        return
    result = fetch(query)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False))
    kinds = {}
    for el in result.get("elements", []):
        kinds[el["type"]] = kinds.get(el["type"], 0) + 1
    print(f"寫入 {out}：{kinds}")


def main():
    skip_existing = "--skip-existing" in sys.argv
    save(build_query(BBOX), OUT, skip_existing)
    save(build_poi_query(BBOX), POI_OUT, skip_existing)


if __name__ == "__main__":
    main()
