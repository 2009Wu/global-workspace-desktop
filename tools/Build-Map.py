"""Generate the checked-in, offline Natural Earth assets from pinned source ZIPs.

Usage: python tools/Build-Map.py SOURCE_CACHE
Build-only dependencies: pyshp 2.3.1, shapely 2.1.2, numpy and Pillow.
"""
import gzip
import hashlib
import json
import math
import sys
import urllib.request
from pathlib import Path
from zipfile import ZipFile

import numpy as np
import shapefile
from PIL import Image
from shapely import get_parts, make_valid, set_precision, to_geojson
from shapely.geometry import MultiPolygon, Point, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1] / "ui"
OUT = ROOT / "atlas"
CACHE = Path(sys.argv[1])
SOURCES = {
    "10m_cultural/ne_10m_admin_0_countries_chn": "16e7589083527d01208b9f645fc8643c767170258e9d13b59d37bc5a1f6a8758",
    "10m_cultural/ne_10m_admin_1_states_provinces_lines": "86acd56ce6c0e47f5fa79725591533b5766f26d6ed1437b086f2b8d4028fe456",
    "10m_cultural/ne_10m_admin_0_disputed_areas": "a250c1cf8ab68898399928a1fa1d5c242eb4de6335cb51a7f7a7f12a9f3c8438",
    "10m_cultural/ne_10m_populated_places": "cd149186f03d2603e0410da399b980a4357d0ac32d3a2305a49ed3dffcc41d7b",
    "10m_physical/ne_10m_lakes": "0803a06f9c3cb4671d89b68c48b142aad9366ba40f665245e12a913fbc61722a",
    "10m_physical/ne_10m_rivers_lake_centerlines": "ded71b01870855ccfe19b51f2ec14c9bb48fae23c0e9f3c11974d426433b5c38",
    "50m_raster/GRAY_50M_SR_W": "25230eaa5c82c9e913b9acede197e29e575817e36df9925231c1a1b92a101d8c",
}
CODES = {"B77": "CN-TW", "B07": "CN-AKS", "B00": "CN-ZAN"}


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def blob(name, obj):
    (OUT / name).write_bytes(gzip.compress(compact(obj).encode(), compresslevel=8, mtime=0))


def source_files():
    files = {}
    for src, digest in SOURCES.items():
        name = src.split("/")[-1]
        dest = CACHE / (name + ".zip")
        if not dest.exists():
            urllib.request.urlretrieve("https://naturalearth.s3.amazonaws.com/" + src + ".zip", dest)
        if hashlib.sha256(dest.read_bytes()).hexdigest() != digest:
            raise ValueError("Unexpected Natural Earth archive: " + name)
        files[name] = dest
    return files


def geometry(obj, grid=0.00001):
    # Round for storage only. Fast pointwise rounding keeps rings and shared border vertices.
    return json.loads(to_geojson(set_precision(obj, grid, mode="pointwise")))


def polygonal(g):
    polys = [part for part in get_parts(g) if part.geom_type in ("Polygon", "MultiPolygon")]
    return unary_union(polys)


def build_countries(files):
    base, countries, children = [], {}, {}
    for feat in shapefile.Reader(str(files["ne_10m_admin_0_countries_chn"])).iterShapeRecords():
        d = feat.record.as_dict()
        iso = d["ADM0_A3"]
        g = shape(feat.shape.__geo_interface__)
        countries[iso] = g
        props = dict(iso=iso, iso2=d["ISO_A2_EH"], en=d["NAME_EN"], name=d["NAME_ZH"],
                     region=d["CONTINENT"], rank=d["LABELRANK"], lat=d["LABEL_Y"], lon=d["LABEL_X"])
        # Drop microscopic islands only in the world overview. Exact files retain all rings.
        parts = list(get_parts(g))
        large = [part for part in parts if part.area >= .008] or [max(parts, key=lambda p:p.area)]
        overview = MultiPolygon([p.simplify(.045, preserve_topology=True) for p in large])
        base.append(dict(type="Feature", bbox=list(g.bounds), properties=props,
                         geometry=geometry(overview, .0001)))
        blob(iso + ".gz", geometry(g))
    for feat in shapefile.Reader(str(files["ne_10m_admin_0_disputed_areas"])).iterShapeRecords():
        code = CODES.get(feat.record["BRK_A3"])
        if code:
            g = polygonal(make_valid(shape(feat.shape.__geo_interface__)).intersection(make_valid(countries["CHN"])))
            if g.is_empty:
                raise ValueError(code)
            children[code] = g
            blob(code + ".gz", geometry(g))
    for iso, coords in {"CN-TW": [(121.565,25.04),(120.30,22.63)],
                        "CN-AKS": [(80,35.2)], "CN-ZAN": [(91.86,27.59),(93.62,27.10)]}.items():
        for xy in coords:
            pt = Point(xy)
            assert children[iso].covers(pt) and countries["CHN"].covers(pt) and not countries["IND"].covers(pt), (iso, xy)
    assert "TWN" not in countries and countries["IND"].covers(Point(88.61,27.33))
    # Include the child footprints before detail loads so offline navigation is immediate.
    for code, g in children.items():
        f = dict(type="Feature", bbox=list(g.bounds), geometry=geometry(g.simplify(.012)),
                 properties=dict(iso=code, parent="CHN"))
        base.append(f)
    (ROOT / "world.js").write_text("const world = "+compact(dict(type="FeatureCollection",features=base))+";\n", encoding="utf-8")


def build_physical(files):
    lines = []
    # Near the requested land boundary, clip secondary lines inside the appropriate
    # country polygon, leaving the international outline visually distinct.
    masks = {}
    for f in shapefile.Reader(str(files["ne_10m_admin_0_countries_chn"])).iterShapeRecords():
        if f.record["ADM0_A3"] in ("IND", "CHN"):
            masks[f.record["ADM0_A3"]] = make_valid(shape(f.shape.__geo_interface__)).buffer(-.002)
    for feat in shapefile.Reader(str(files["ne_10m_admin_1_states_provinces_lines"])).iterShapeRecords():
        d = feat.record.as_dict()
        if not feat.shape.points:
            continue
        if (d["FCLASS_CN"] or d["FEATURECLA"]) not in ("Admin-1 boundary","Admin-1 region boundary"):
            continue
        g = shape(feat.shape.__geo_interface__)
        if d["ADM0_A3"] in masks and g.bounds[0]<100 and g.bounds[2]>73 and g.bounds[1]<38 and g.bounds[3]>25:
            g = g.intersection(masks[d["ADM0_A3"]])
        if g.is_empty or g.geom_type not in ("LineString","MultiLineString"):
            continue
        lines.append(dict(type="Feature", bbox=list(g.bounds), properties={"z":max(4.5,d["MIN_ZOOM"] or 5),"admin":True},
                          geometry=geometry(g.simplify(.001))))
    blob("admin1.gz", lines)
    for kind, src in [("lakes","ne_10m_lakes"),("rivers","ne_10m_rivers_lake_centerlines")]:
        data = []
        for feat in shapefile.Reader(str(files[src])).iterShapeRecords():
            g = shape(feat.shape.__geo_interface__)
            d = feat.record.as_dict()
            data.append(dict(type="Feature", bbox=list(g.bounds), properties={"z": d["min_zoom"] or 3},
                             geometry=geometry(g)))
        blob(kind + ".gz", data)
    places = []
    for feat in shapefile.Reader(str(files["ne_10m_populated_places"])).iterShapeRecords():
        d = feat.record.as_dict()
        places.append([d["MIN_ZOOM"], round(d["LATITUDE"],5), round(d["LONGITUDE"],5), d["NAME"],
                       d.get("NAME_ZH") or "", d.get("NAME_ZHT") or "", d["POP_MAX"]])
    blob("places.gz", sorted(places,key=lambda p:(p[0],-p[6])))


def build_relief(files):
    # Author 8x8 offline tiles in Web Mercator, with 4x raster resolution per tile.
    with ZipFile(files["GRAY_50M_SR_W"]) as z:
        with z.open("GRAY_50M_SR_W.tif") as tif:
            source = Image.open(tif).resize((8192,4096),Image.Resampling.LANCZOS)
    raster = np.asarray(source)
    colors = np.array([[12,28,41],[16,39,52],[28,49,56],[45,71,70],[72,94,82],[99,113,95]])
    lut = np.column_stack([np.interp(np.arange(256),[0,110,135,177,210,255],colors[:,k]) for k in range(3)])
    small = Image.new("RGB",(1024,1024))
    for y in range(8):
        rows = y*1024 + np.arange(1024) + .5
        lat = np.rad2deg(np.arctan(np.sinh(math.pi*(1-2*rows/8192))))
        src_y = (90-lat)/180*raster.shape[0]-.5
        i = np.floor(src_y).astype(int)
        fraction = (src_y-i)[:,None]
        for x in range(8):
            area = raster[:,x*1024:(x+1)*1024]
            gray = np.rint((1-fraction)*area[i] + fraction*area[i+1]).astype(np.uint8)
            tile = Image.fromarray(lut[gray].astype(np.uint8))
            tile.save(OUT / ("relief-3-%d-%d.webp"%(x,y)),quality=84,method=4)
            small.paste(tile.resize((128,128),Image.Resampling.LANCZOS),(x*128,y*128))
    for z in range(3):
        count=2**z
        img=small.resize((256*count,256*count),Image.Resampling.LANCZOS)
        for x in range(count):
            for y in range(count):
                img.crop((x*256,y*256,(x+1)*256,(y+1)*256)).save(OUT / ("relief-%d-%d-%d.webp"%(z,x,y)),quality=86)


if __name__ == "__main__":
    CACHE.mkdir(parents=True,exist_ok=True)
    OUT.mkdir(exist_ok=True)
    inputs=source_files()
    build_countries(inputs)
    build_physical(inputs)
    build_relief(inputs)
    print("Generated cartography in", OUT)
