"""Extract the historical splits used by the UN seat map. Pass the Cliopatria v0.0.1 ZIP."""
import gzip
import hashlib
import json
import sys
from pathlib import Path
from zipfile import ZipFile

from shapely import get_parts, make_valid, set_precision, to_geojson
from shapely.geometry import Point, shape
from shapely.ops import unary_union

atlas = Path(__file__).resolve().parents[1] / "ui" / "atlas"
source = Path(sys.argv[1])
if hashlib.sha256(source.read_bytes()).hexdigest() != "a1c4a935886557ef5858d97294d78c7854319b8879c4a7d181c5497d7f62f524":
    raise ValueError("Expected the Cliopatria v0.0.1 release archive")

def land(code):
    return make_valid(shape(json.loads(gzip.decompress((atlas / (code + ".gz")).read_bytes()))))

def polygons(g):
    return unary_union([p for p in get_parts(g) if p.geom_type in ("Polygon", "MultiPolygon")])

# These partitions align to the coastline of the app's Natural Earth atlas.
pieces = {}
with ZipFile(source) as z, z.open("cliopatria.geojson") as data:
    for line in data:
        if not line.startswith(b'{ "type": "Feature",'):
            continue
        obj = json.loads(line.rstrip().rstrip(b","))
        p = obj["properties"]
        if (p["Name"], p["FromYear"]) == ("North Yemen", 1936):
            pieces["YEM"] = polygons(land("YEM").intersection(make_valid(shape(obj["geometry"]))))
        if (p["Name"], p["FromYear"]) == ("German Democratic Republic", 1953):
            pieces["DDR"] = polygons(land("DEU").intersection(make_valid(shape(obj["geometry"]))))
pieces["EAZ"] = unary_union([p for p in get_parts(land("TZA")) if
                             39.0 < p.centroid.x < 40 and -6.6 < p.centroid.y < -4.8])
for code, parent, complement in [("YEM","YEM","YMD"),("DDR","DEU","GER"),("EAZ","TZA","EAT")]:
    pieces[complement] = polygons(land(parent).difference(pieces[code]))
for code, xy in {"YEM":(44.21,15.35),"YMD":(45.03,12.80),"DDR":(12.37,51.34),
                 "GER":(7.10,50.74),"EAZ":(39.21,-6.16),"EAT":(39.27,-6.82)}.items():
    if not pieces[code].covers(Point(xy)):
        raise ValueError("Seat polygon misses check point: " + code)
out = {k:json.loads(to_geojson(set_precision(v.simplify(.0008),.00005))) for k,v in pieces.items()}
(atlas / "vote-splits.json").write_text(json.dumps(out,separators=(",",":")),encoding="utf-8")
