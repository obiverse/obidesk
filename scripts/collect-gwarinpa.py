#!/usr/bin/env python3
"""
obiDesk — Gwarinpa Business Collector
Queries OpenStreetMap Overpass API for all businesses in Gwarinpa, Abuja.
Outputs formatted businesses.json entries ready for obiDesk.

Usage:
  python3 scripts/collect-gwarinpa.py
  python3 scripts/collect-gwarinpa.py --area wuse
  python3 scripts/collect-gwarinpa.py --all-abuja
"""

import json
import sys
import ssl
import urllib.request
import urllib.parse
import re
from datetime import datetime

# macOS Python SSL fix
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

# ── Abuja area bounding boxes (south,west,north,east) ──
AREAS = {
    "gwarinpa":     (9.055, 7.390, 9.105, 7.445),
    "wuse":         (9.045, 7.475, 9.070, 7.510),
    "wuse2":        (9.050, 7.480, 9.075, 7.505),
    "jabi":         (9.030, 7.410, 9.060, 7.445),
    "maitama":      (9.070, 7.485, 9.100, 7.515),
    "garki":        (9.010, 7.475, 9.040, 7.510),
    "asokoro":      (9.030, 7.510, 9.060, 7.550),
    "kubwa":        (9.120, 7.300, 9.175, 7.360),
    "lugbe":        (8.970, 7.350, 9.010, 7.400),
    "utako":        (9.050, 7.435, 9.075, 7.465),
    "lifecamp":     (9.055, 7.390, 9.085, 7.420),
    "central-area": (9.045, 7.480, 9.070, 7.510),
    "apo":          (9.000, 7.490, 9.030, 7.530),
    "lokogoma":     (8.960, 7.430, 8.990, 7.470),
    "dei-dei":      (9.100, 7.280, 9.140, 7.330),
    "nyanya":       (9.000, 7.540, 9.030, 7.580),
    "karu":         (8.990, 7.560, 9.020, 7.600),
    "mpape":        (9.090, 7.460, 9.120, 7.500),
    "dutse":        (9.100, 7.340, 9.140, 7.380),
}

# ── OSM tag → obiDesk category mapping ──
CATEGORY_MAP = {
    "school": "schools",
    "kindergarten": "schools",
    "college": "schools",
    "university": "schools",
    "hospital": "clinics",
    "clinic": "clinics",
    "pharmacy": "clinics",
    "doctors": "clinics",
    "dentist": "clinics",
    "restaurant": "restaurants",
    "fast_food": "restaurants",
    "cafe": "restaurants",
    "bar": "restaurants",
    "food_court": "restaurants",
    "hairdresser": "beauty",
    "beauty": "beauty",
    "car_repair": "auto",
    "car_wash": "auto",
    "car": "auto",
    "fuel": "auto",
    "bank": "finance",
    "atm": "finance",
    "bureau_de_change": "finance",
    "place_of_worship": "worship",
    "supermarket": "shops",
    "convenience": "shops",
    "marketplace": "shops",
    "clothes": "shops",
    "electronics": "shops",
    "furniture": "shops",
    "hardware": "shops",
    "mobile_phone": "shops",
    "hotel": "real-estate",
    "guest_house": "real-estate",
    "hostel": "real-estate",
    "estate_agent": "real-estate",
    "gym": "events",
    "computer": "tech",
    "it": "tech",
    "lawyer": "legal",
    "accountant": "legal",
}

def slugify(text):
    s = text.lower().strip()
    s = re.sub(r'[^\w\s-]', '', s)
    s = re.sub(r'[\s_]+', '-', s)
    s = re.sub(r'-+', '-', s)
    return s[:60]

def query_overpass(bbox, area_id):
    """Query Overpass API for all named amenities/shops/offices in a bounding box."""
    south, west, north, east = bbox

    query = f"""
    [out:json][timeout:30];
    (
      node["name"]["amenity"]({south},{west},{north},{east});
      node["name"]["shop"]({south},{west},{north},{east});
      node["name"]["office"]({south},{west},{north},{east});
      node["name"]["tourism"]({south},{west},{north},{east});
      node["name"]["healthcare"]({south},{west},{north},{east});
      way["name"]["amenity"]({south},{west},{north},{east});
      way["name"]["shop"]({south},{west},{north},{east});
    );
    out center;
    """

    url = "https://overpass-api.de/api/interpreter"
    data = urllib.parse.urlencode({"data": query}).encode()

    try:
        req = urllib.request.Request(url, data=data)
        req.add_header("User-Agent", "obiDesk-collector/1.0")
        with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f"  Error querying {area_id}: {e}", file=sys.stderr)
        return {"elements": []}

def classify_business(tags):
    """Map OSM tags to obiDesk category."""
    for key in ["amenity", "shop", "office", "tourism", "healthcare"]:
        val = tags.get(key, "")
        if val in CATEGORY_MAP:
            return CATEGORY_MAP[val]
    # Fallback heuristics
    name = tags.get("name", "").lower()
    if any(w in name for w in ["school", "academy", "college"]): return "schools"
    if any(w in name for w in ["clinic", "hospital", "pharmacy", "medical"]): return "clinics"
    if any(w in name for w in ["restaurant", "kitchen", "food", "suya", "shawarma"]): return "restaurants"
    if any(w in name for w in ["salon", "barber", "hair", "beauty"]): return "beauty"
    if any(w in name for w in ["hotel", "guest", "lodge", "suite"]): return "real-estate"
    if any(w in name for w in ["church", "mosque", "chapel"]): return "worship"
    if any(w in name for w in ["bank", "microfinance"]): return "finance"
    if any(w in name for w in ["mechanic", "auto", "car wash"]): return "auto"
    if any(w in name for w in ["shop", "store", "mart", "supermarket"]): return "shops"
    return "shops"  # default

def osm_to_obidesk(element, area_id, existing_id):
    """Convert an OSM element to an obiDesk business object."""
    tags = element.get("tags", {})
    name = tags.get("name", "").strip()
    if not name or len(name) < 2:
        return None

    # Get coordinates
    lat = element.get("lat") or element.get("center", {}).get("lat")
    lon = element.get("lon") or element.get("center", {}).get("lon")

    phone = tags.get("phone", tags.get("contact:phone", ""))
    website = tags.get("website", tags.get("contact:website", ""))

    cat = classify_business(tags)
    slug = slugify(name + "-" + area_id)

    # Build Google Maps URL
    map_url = ""
    if lat and lon:
        map_url = f"https://maps.google.com/?q={lat},{lon}"

    address = tags.get("addr:street", "")
    if tags.get("addr:housenumber"):
        address = tags["addr:housenumber"] + " " + address

    return {
        "id": existing_id,
        "slug": slug,
        "name": name,
        "tagline": "",
        "description": "",
        "categoryIds": [cat],
        "areaId": area_id,
        "address": address.strip() or f"{area_id.replace('-', ' ').title()}, Abuja",
        "landmark": "",
        "phone": phone,
        "whatsapp": phone.replace("+", "").replace(" ", "").replace("-", "") if phone else "",
        "mapUrl": map_url,
        "services": [],
        "photos": [],
        "tags": [cat, area_id],
        "hours": tags.get("opening_hours", ""),
        "verificationStatus": "unverified",
        "packageTier": "free",
        "featured": False,
        "createdAt": datetime.now().strftime("%Y-%m-%d"),
        "_source": "osm",
        "_osm_id": element.get("id"),
    }

def collect_area(area_id, bbox, start_id):
    """Collect all businesses for one area."""
    print(f"\n  Querying {area_id}...")
    result = query_overpass(bbox, area_id)
    elements = result.get("elements", [])
    print(f"  Found {len(elements)} elements")

    businesses = []
    seen_names = set()
    current_id = start_id

    for el in elements:
        biz = osm_to_obidesk(el, area_id, current_id)
        if biz and biz["name"].lower() not in seen_names:
            seen_names.add(biz["name"].lower())
            businesses.append(biz)
            current_id += 1

    print(f"  Unique businesses: {len(businesses)}")
    return businesses, current_id

def main():
    areas_to_query = ["gwarinpa"]

    if "--all-abuja" in sys.argv:
        areas_to_query = list(AREAS.keys())
    elif "--area" in sys.argv:
        idx = sys.argv.index("--area") + 1
        if idx < len(sys.argv) and sys.argv[idx] in AREAS:
            areas_to_query = [sys.argv[idx]]

    print(f"obiDesk Collector — Querying {len(areas_to_query)} area(s)")
    print(f"Source: OpenStreetMap Overpass API")

    all_businesses = []
    current_id = 100  # Start after sample data

    for area_id in areas_to_query:
        bbox = AREAS[area_id]
        businesses, current_id = collect_area(area_id, bbox, current_id)
        all_businesses.extend(businesses)

    # Category summary
    cats = {}
    for b in all_businesses:
        for c in b["categoryIds"]:
            cats[c] = cats.get(c, 0) + 1

    print(f"\n{'='*40}")
    print(f"Total: {len(all_businesses)} businesses")
    print(f"Categories: {json.dumps(cats, indent=2)}")

    # Output
    outfile = f"docs/data/collected-{'-'.join(areas_to_query)}.json"
    with open(outfile, "w") as f:
        json.dump(all_businesses, f, indent=2, ensure_ascii=False)
    print(f"\nSaved to: {outfile}")
    print(f"\nTo merge into businesses.json:")
    print(f"  python3 scripts/collect-gwarinpa.py --merge")

    if "--merge" in sys.argv:
        merge_into_main(all_businesses)

def merge_into_main(new_businesses):
    """Merge collected businesses into the main businesses.json, avoiding duplicates."""
    main_file = "docs/data/businesses.json"
    try:
        with open(main_file) as f:
            existing = json.load(f)
    except:
        existing = []

    existing_slugs = {b["slug"] for b in existing}
    existing_names = {b["name"].lower() for b in existing}

    added = 0
    for biz in new_businesses:
        if biz["slug"] not in existing_slugs and biz["name"].lower() not in existing_names:
            # Remove internal fields
            biz.pop("_source", None)
            biz.pop("_osm_id", None)
            existing.append(biz)
            added += 1

    with open(main_file, "w") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)

    print(f"\nMerged: {added} new businesses added (total: {len(existing)})")

if __name__ == "__main__":
    main()
