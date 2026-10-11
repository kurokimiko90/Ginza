"""銀座的街景標示資料：店家招牌、袖看板（多店家直立招牌）、街道名牌、街名標籤、和光鐘樓位置。

輸入皆為已投影的本地公尺座標（x 東、z 南），由 build_city.py 呼叫。
"""
import math

SIGN_SEARCH_M = 25        # 店家點位離外牆超過此距離就不放招牌
MIN_EDGE_M = 2.5          # 太短的牆面不放招牌
SIGN_SLOTS = (0.5, 0.25, 0.75)  # 同一面牆最多 3 塊招牌的位置（牆長比例）
BOARD_T = 0.08            # 袖看板放在靠牆角處
CROWN_EXCLUDE = ("ビル", "ビルディング", "ビルヂング", "マンション", "宿舎")
MAIN_KINDS = {"trunk", "primary", "secondary", "tertiary"}
STREET_KINDS = MAIN_KINDS | {"unclassified", "residential", "pedestrian", "living_street"}
STREET_SIGN_SPACING = 120  # 同名街道名牌的最小間距
SIDEWALK_GAP = 1.5         # 名牌立在路緣外側的距離
MAX_STREET_LABELS = 14


def point_in_ring(x, z, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, zi = ring[i]
        xj, zj = ring[j]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi:
            inside = not inside
        j = i
    return inside


def outward_normal(ring, p, q):
    """回傳牆面 p→q 朝外的單位法向量 (nx, nz)。"""
    dx, dz = q[0] - p[0], q[1] - p[1]
    length = math.hypot(dx, dz)
    nx, nz = dz / length, -dx / length
    mx, mz = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
    if point_in_ring(mx + nx * 0.3, mz + nz * 0.3, ring):
        nx, nz = -nx, -nz
    return nx, nz


def ring_bbox(rings):
    xs = [pt[0] for r in rings for pt in r]
    zs = [pt[1] for r in rings for pt in r]
    return (min(xs), min(zs), max(xs), max(zs))


def near_box(x, z, box, margin):
    return box[0] - margin <= x <= box[2] + margin and box[1] - margin <= z <= box[3] + margin


def segment_distance(x, z, p, q):
    dx, dz = q[0] - p[0], q[1] - p[1]
    seg = dx * dx + dz * dz or 1e-9
    t = max(0.0, min(1.0, ((x - p[0]) * dx + (z - p[1]) * dz) / seg))
    return math.hypot(p[0] + dx * t - x, p[1] + dz * t - z), t


def nearest_edge(x, z, buildings, boxes):
    """找離 (x, z) 最近的外牆，回傳 (距離, 建築, 環, 邊索引)。"""
    best = None
    for b, box in zip(buildings, boxes):
        if not near_box(x, z, box, SIGN_SEARCH_M):
            continue
        for ring in b["outers"]:
            for k in range(len(ring)):
                p, q = ring[k], ring[(k + 1) % len(ring)]
                if math.dist(p, q) < MIN_EDGE_M:
                    continue
                d, _ = segment_distance(x, z, p, q)
                if d <= SIGN_SEARCH_M and (best is None or d < best[0]):
                    best = (d, b, ring, k)
    return best


def wall_point(ring, k, t):
    p, q = ring[k], ring[(k + 1) % len(ring)]
    nx, nz = outward_normal(ring, p, q)
    x, z = p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t
    return round(x, 2), round(z, 2), round(nx, 4), round(nz, 4), math.dist(p, q)


def make_sign(text, kind, b, ring, k, slot):
    t = SIGN_SLOTS[slot]
    x, z, nx, nz, length = wall_point(ring, k, t)
    return {
        "text": text[:24], "kind": kind, "x": x, "z": z, "nx": nx, "nz": nz,
        "room": round(length * min(t, 1 - t) * 2, 1), "top": b["height"], "slot": slot,
    }


def main_street_distance(x, z, main_roads):
    return min((segment_distance(x, z, a, b)[0] for pts in main_roads for a, b in zip(pts, pts[1:])), default=999)


def shop_signs(buildings, roads, pois):
    """店家點位 → 外牆招牌與袖看板。招牌依離主要道路的距離排序（臨大街者優先顯示）。"""
    candidates = [b for b in buildings if b.get("base", 0) < 2 and b["height"] >= 5]
    boxes = [ring_bbox(b["outers"]) for b in candidates]
    main_roads = [r["points"] for r in roads if r["kind"] in MAIN_KINDS]
    used, tenants, signs = {}, {}, []
    for x, z, tags in pois:
        text = tags.get("name:ja") or tags.get("name")
        if not text:
            continue
        hit = nearest_edge(x, z, candidates, boxes)
        if not hit:
            continue
        _, b, ring, k = hit
        tenants.setdefault(b["id"], {"b": b, "ring": ring, "k": k, "names": []})["names"].append(text[:14])
        slot = used.get((b["id"], k), 0)
        if slot >= len(SIGN_SLOTS):
            continue
        used[(b["id"], k)] = slot + 1
        kind = tags.get("shop") and "shop" or tags.get("amenity") or tags.get("tourism") or "shop"
        sign = make_sign(text, kind, b, ring, k, slot)
        # 原始 OSM 分類，前端用來挑選室內陳列類型（kind 仍維持既有語意）。
        sign["cat"] = tags.get("shop") or tags.get("amenity") or tags.get("tourism") or "shop"
        sign["prio"] = round(main_street_distance(sign["x"], sign["z"], main_roads), 1)
        signs.append(sign)
    signs.sort(key=lambda s: s["prio"])

    boards = []
    for t in tenants.values():
        names = list(dict.fromkeys(t["names"]))  # 去重並保留順序
        if len(names) < 2 or t["b"]["height"] < 12:
            continue
        x, z, nx, nz, _ = wall_point(t["ring"], t["k"], BOARD_T)
        boards.append({"names": names[:7], "x": x, "z": z, "nx": nx, "nz": nz, "top": t["b"]["height"]})
    return signs, boards


def crown_signs(buildings):
    """有名稱的大型商業建築（百貨、飯店、劇場）→ 頂部招牌。"""
    crowns = []
    for b in buildings:
        name = b.get("name", "")
        if b["height"] < 20 or not name or any(w in name for w in CROWN_EXCLUDE):
            continue
        ring = b["outers"][0]
        k = max(range(len(ring)), key=lambda i: math.dist(ring[i], ring[(i + 1) % len(ring)]))
        if math.dist(ring[k], ring[(k + 1) % len(ring)]) >= 8:
            crowns.append({**make_sign(name, "crown", b, ring, k, 0), "prio": 0})
    return crowns


def street_name(tags_name):
    return (tags_name or "").split(";")[0].strip()


def is_street(name):
    return "通り" in name or name == "第一京浜"


def blocked(x, z, buildings, boxes):
    return any(near_box(x, z, box, 0) and any(point_in_ring(x, z, r) for r in b["outers"]) for b, box in zip(buildings, boxes))


def street_signs(roads, buildings):
    """沿有名稱的街道，每隔 STREET_SIGN_SPACING 在路緣立一支名牌；另回傳鳥瞰街名標籤位置。"""
    boxes = [ring_bbox(b["outers"]) for b in buildings]
    placed, signs, totals = {}, [], {}
    for road in roads:
        name = road.get("name", "")
        if road["kind"] not in STREET_KINDS or not is_street(name):
            continue
        pts = road["points"]
        seg_len = sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))
        best = totals.get(name)
        totals[name] = {
            "length": (best["length"] if best else 0) + seg_len,
            "longest": max(best["longest"], (seg_len, pts)) if best else (seg_len, pts),
            "en": road.get("en", ""),
        }
        for a, b in zip(pts, pts[1:]):
            length = math.dist(a, b)
            if length < 1:
                continue
            dx, dz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
            offset = road["width"] / 2 + SIDEWALK_GAP
            for s in range(0, int(length), 25):
                x = a[0] + dx * s + dz * offset   # 行進方向左側
                z = a[1] + dz * s - dx * offset
                if any(math.dist((x, z), p) < STREET_SIGN_SPACING for p in placed.get(name, [])):
                    continue
                if blocked(x, z, buildings, boxes):
                    continue
                placed.setdefault(name, []).append((x, z))
                signs.append({"name": name, "en": road.get("en", ""), "x": round(x, 2), "z": round(z, 2), "dx": round(dx, 4), "dz": round(dz, 4)})

    labels = []
    for name, info in sorted(totals.items(), key=lambda kv: -kv[1]["length"]):
        if info["length"] < 120:
            continue
        pts = info["longest"][1]
        mid = pts[len(pts) // 2] if len(pts) > 2 else [(pts[0][0] + pts[-1][0]) / 2, (pts[0][1] + pts[-1][1]) / 2]
        labels.append({"name": name, "en": info["en"], "x": round(mid[0], 1), "z": round(mid[1], 1)})
    return signs, labels[:MAX_STREET_LABELS]


def crossing_point(roads, a="中央通り", b="晴海通り"):
    """兩條街共用的節點平均值＝交差點中心；找不到時回傳原點。"""
    nodes_a = {tuple(p) for r in roads if r.get("name") == a for p in r["points"]}
    shared = {tuple(p) for r in roads if r.get("name") == b for p in r["points"] if tuple(p) in nodes_a}
    if not shared:
        return (0.0, 0.0)
    return (sum(p[0] for p in shared) / len(shared), sum(p[1] for p in shared) / len(shared))


def wako_clock(buildings, roads):
    """和光鐘樓：放在和光建築最靠近銀座四丁目交差點的轉角內側。"""
    wako = next((b for b in buildings if b.get("name") == "和光"), None)
    if not wako:
        return None
    cross = crossing_point(roads)
    ring = wako["outers"][0]
    corner = min(ring, key=lambda p: math.dist(p, cross))
    cx = sum(p[0] for p in ring) / len(ring)
    cz = sum(p[1] for p in ring) / len(ring)
    d = math.dist(corner, (cx, cz)) or 1
    t = min(6, d * 0.5) / d
    return {
        "x": round(corner[0] + (cx - corner[0]) * t, 2), "z": round(corner[1] + (cz - corner[1]) * t, 2),
        "base": wako["height"], "face": [round(cross[0], 2), round(cross[1], 2)],
    }


def build_signage(buildings, roads, pois):
    signs, boards = shop_signs(buildings, roads, pois)
    street, labels = street_signs(roads, buildings)
    return {
        "signs": crown_signs(buildings) + signs,
        "boards": boards,
        "streetSigns": street,
        "streets": labels,
        "clock": wako_clock(buildings, roads),
    }
