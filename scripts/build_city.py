"""把 work/ginza_osm.json 轉成網頁用的 web/assets/city.json 與 roads.json。

座標系：以 ORIGIN 為原點，x = 往東公尺，z = 往南公尺（北方為 -z），y = 高度公尺。
"""
import hashlib
import json
import math
import sys
from pathlib import Path

from fetch_osm import BBOX
from signage import build_signage, street_name

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "work" / "ginza_osm.json"
POI_SRC = ROOT / "work" / "ginza_poi.json"
OUT_DIR = ROOT / "web" / "assets"

ORIGIN = (35.6712, 139.7655)  # 約為銀座四丁目交差點
EARTH_R = 6378137.0
FLOOR_M = 3.4
SKIP_BUILDING = {"roof", "construction", "no", "ruins", "carport"}
SKIP_HIGHWAY = {"construction", "proposed", "corridor", "elevator", "platform"}
ROAD_WIDTH = {
    "motorway": 14, "trunk": 22, "primary": 20, "secondary": 15, "tertiary": 11,
    "motorway_link": 7, "trunk_link": 8, "primary_link": 8, "secondary_link": 7,
    "unclassified": 7, "residential": 6, "service": 4, "pedestrian": 8,
    "living_street": 5, "footway": 2, "steps": 2, "path": 2, "cycleway": 2,
}
# 知名建築的高度補正（公開資料的概略值；OSM 未標高度時使用）
LANDMARK_HEIGHT = {
    "歌舞伎座タワー": 145.5,
    "歌舞伎座": 32.0,
    "三越銀座店": 40.0,
    "松屋銀座": 40.0,
}
# 網頁上的快速定位點：顯示名稱 → OSM 建築名稱
LANDMARKS = [
    ("銀座四丁目・和光", "和光"),
    ("歌舞伎座", "歌舞伎座"),
    ("GINZA SIX", "GINZA SIX"),
    ("東急プラザ銀座", "東急プラザ銀座"),
]


def project(lat, lon):
    x = math.radians(lon - ORIGIN[1]) * EARTH_R * math.cos(math.radians(ORIGIN[0]))
    z = -math.radians(lat - ORIGIN[0]) * EARTH_R
    return round(x, 2), round(z, 2)


def parse_float(value):
    if value is None:
        return None
    try:
        return float(str(value).replace("m", "").strip().split(";")[0])
    except ValueError:
        return None


def ring_area(ring):
    area = 0.0
    for (x1, z1), (x2, z2) in zip(ring, ring[1:] + ring[:1]):
        area += x1 * z2 - x2 * z1
    return area / 2


def stable_unit(key):
    """以 id 產生 0–1 的固定亂數，讓每次建置結果一致。"""
    return int(hashlib.md5(str(key).encode()).hexdigest()[:8], 16) / 0xFFFFFFFF


def estimate_height(tags, area, key):
    """回傳 (高度, 估算方式)。"""
    height = parse_float(tags.get("height"))
    if height:
        return height, "OSM height"
    levels = parse_float(tags.get("building:levels"))
    if levels:
        return levels * FLOOR_M, f"OSM levels x {FLOOR_M} m"
    name = tags.get("name", "")
    if name in LANDMARK_HEIGHT:
        return LANDMARK_HEIGHT[name], "Landmark override (approximate)"
    # 銀座多為 5–12 層的中層商辦：依占地面積推估層數，再加上固定亂數擾動
    if area < 60:
        floors = 3
    elif area < 150:
        floors = 5
    elif area < 400:
        floors = 7
    elif area < 1500:
        floors = 9
    else:
        floors = 11
    floors += round((stable_unit(key) - 0.5) * 4)
    return max(2, floors) * FLOOR_M, "Estimated from footprint area"


def join_rings(segments):
    """把 multipolygon 的多段 way 接成封閉環。"""
    segments = [list(s) for s in segments if len(s) >= 2]
    rings = []
    while segments:
        ring = segments.pop(0)
        while ring[0] != ring[-1]:
            for i, seg in enumerate(segments):
                if seg[0] == ring[-1]:
                    ring += seg[1:]
                elif seg[-1] == ring[-1]:
                    ring += seg[-2::-1]
                elif seg[-1] == ring[0]:
                    ring = seg[:-1] + ring
                elif seg[0] == ring[0]:
                    ring = seg[:0:-1] + ring
                else:
                    continue
                segments.pop(i)
                break
            else:
                break  # 無法閉合，丟棄
        if ring[0] == ring[-1] and len(ring) >= 4:
            rings.append(ring)
    return rings


def to_xz(node_ids, nodes):
    points = [project(*nodes[n]) for n in node_ids if n in nodes]
    if len(points) > 1 and points[0] == points[-1]:
        points = points[:-1]
    return points


def make_building(key, tags, outers, inners, nodes):
    outer_rings = [r for r in (to_xz(o, nodes) for o in outers) if len(r) >= 3]
    if not outer_rings:
        return None
    holes = [r for r in (to_xz(i, nodes) for i in inners) if len(r) >= 3]
    area = sum(abs(ring_area(r)) for r in outer_rings)
    if area < 8:
        return None
    height, method = estimate_height(tags, area, key)
    base = parse_float(tags.get("min_height")) or 0.0
    if base >= height:
        base = 0.0
    building = {
        "id": key,
        "height": round(height, 1),
        "base": round(base, 1),
        "method": method,
        "tone": round(stable_unit(f"tone{key}"), 3),
        "outers": outer_rings,
    }
    if holes:
        building["holes"] = holes
    if tags.get("name"):
        building["name"] = tags["name"]
    return building


def collect(data):
    nodes = {e["id"]: (e["lat"], e["lon"]) for e in data["elements"] if e["type"] == "node"}
    ways = {e["id"]: e for e in data["elements"] if e["type"] == "way"}
    buildings, roads = [], []

    for way in ways.values():
        tags = way.get("tags", {})
        if tags.get("building") and tags["building"] not in SKIP_BUILDING and (parse_float(tags.get("layer") or 0) or 0) >= 0:
            b = make_building(f"w{way['id']}", tags, [way["nodes"]], [], nodes)
            if b:
                buildings.append(b)
        kind = tags.get("highway")
        if kind and kind not in SKIP_HIGHWAY and (parse_float(tags.get("layer") or 0) or 0) == 0 and tags.get("tunnel") != "yes":
            points = [project(*nodes[n]) for n in way["nodes"] if n in nodes]
            if len(points) >= 2:
                tagged_width = parse_float(tags.get("width"))
                valid_width = bool(tagged_width and math.isfinite(tagged_width) and tagged_width > 0)
                road = {"kind": kind, "width": tagged_width if valid_width else ROAD_WIDTH.get(kind, 4), "widthSource": "osm" if valid_width else "estimated", "points": points}
                if tags.get("footway") == "crossing":
                    road["crossing"] = True
                    road["marked"] = tags.get("crossing") in {"marked", "zebra"} or tags.get("crossing:markings") in {"yes", "zebra"}
                if tags.get("name"):
                    road["name"] = street_name(tags["name"])
                    road["en"] = street_name(tags.get("name:en", ""))
                roads.append(road)

    for rel in (e for e in data["elements"] if e["type"] == "relation"):
        tags = rel.get("tags", {})
        if not tags.get("building") or tags.get("type") != "multipolygon":
            continue
        members = [m for m in rel["members"] if m["type"] == "way" and m["ref"] in ways]
        outers = join_rings([ways[m["ref"]]["nodes"] for m in members if m["role"] == "outer"])
        inners = join_rings([ways[m["ref"]]["nodes"] for m in members if m["role"] == "inner"])
        b = make_building(f"r{rel['id']}", tags, outers, inners, nodes)
        if b:
            buildings.append(b)
    return buildings, roads


def find_landmarks(buildings):
    result = []
    for label, name in LANDMARKS:
        match = next((b for b in buildings if b.get("name") == name), None)
        if not match:
            print(f"[warn] 找不到地標 {name}", file=sys.stderr)
            continue
        ring = match["outers"][0]
        cx = sum(p[0] for p in ring) / len(ring)
        cz = sum(p[1] for p in ring) / len(ring)
        result.append({"label": label, "id": match["id"], "target": [round(cx, 1), round(cz, 1)], "height": match["height"]})
    return result


def clip_bounds():
    """BBOX 轉成本地公尺座標 [minX, minZ, maxX, maxZ]。"""
    x0, z1 = project(BBOX[0], BBOX[1])
    x1, z0 = project(BBOX[2], BBOX[3])
    return [x0, z0, x1, z1]


def inside(point, box):
    return box[0] <= point[0] <= box[2] and box[1] <= point[1] <= box[3]


def clip(buildings, roads, box):
    """丟掉中心在範圍外的建築；道路只保留兩端都在範圍內的線段。"""
    kept = []
    for b in buildings:
        ring = b["outers"][0]
        center = (sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring))
        if inside(center, box):
            kept.append(b)
    clipped = []
    for road in roads:
        run = []
        for point in road["points"] + [None]:
            if point is not None and inside(point, box):
                run.append(point)
                continue
            if len(run) >= 2:
                clipped.append({**road, "points": run})
            run = []
    return kept, clipped


def bounds_of(buildings, roads):
    xs, zs = [], []
    for b in buildings:
        for ring in b["outers"]:
            xs += [p[0] for p in ring]
            zs += [p[1] for p in ring]
    for r in roads:
        xs += [p[0] for p in r["points"]]
        zs += [p[1] for p in r["points"]]
    return [math.floor(min(xs)), math.floor(min(zs)), math.ceil(max(xs)), math.ceil(max(zs))]


def load_pois():
    """店家點位，投影成 (x, z, tags)。"""
    if not POI_SRC.exists():
        print(f"[warn] 找不到 {POI_SRC}，不產生招牌（先執行 scripts/fetch_osm.py）", file=sys.stderr)
        return []
    elements = json.loads(POI_SRC.read_text())["elements"]
    return [(*project(e["lat"], e["lon"]), e.get("tags", {})) for e in elements if "lat" in e]


def main():
    if not SRC.exists():
        raise SystemExit(f"找不到 {SRC}，請先執行 scripts/fetch_osm.py")
    buildings, roads = clip(*collect(json.loads(SRC.read_text())), clip_bounds())
    city = {
        "origin": ORIGIN,
        "bounds": bounds_of(buildings, roads),
        "landmarks": find_landmarks(buildings),
        **build_signage(buildings, roads, load_pois()),
        "buildings": buildings,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "city.json").write_text(json.dumps(city, ensure_ascii=False, separators=(",", ":")))
    (OUT_DIR / "roads.json").write_text(json.dumps(roads, ensure_ascii=False, separators=(",", ":")))
    methods = {}
    for b in buildings:
        methods[b["method"]] = methods.get(b["method"], 0) + 1
    w = city["bounds"][2] - city["bounds"][0]
    d = city["bounds"][3] - city["bounds"][1]
    print(f"建築 {len(buildings)}、道路 {len(roads)}、範圍 {w}×{d} m")
    print(f"高度來源：{methods}")
    print(f"地標：{[l['label'] for l in city['landmarks']]}")
    crowns = sum(1 for s in city["signs"] if s["kind"] == "crown")
    print(f"招牌：{len(city['signs'])}（頂部招牌 {crowns}）、袖看板 {len(city['boards'])}、街道名牌 {len(city['streetSigns'])}")
    print(f"街名標籤：{[s['name'] for s in city['streets']]}；和光鐘樓：{city['clock']}")


if __name__ == "__main__":
    main()
