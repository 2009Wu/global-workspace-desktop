"""Build offline overview polygons and geographic hillshade for the UN vote map.

Usage: python tools/Build-Vote-Atlas.py PATH_TO_GRAY_50M_SR_W.zip
Run after Build-Map.py. Both maps use the same checked-in national outlines.
"""
import gzip
import hashlib
import json
import sys
from pathlib import Path
from zipfile import ZipFile

import numpy as np
from PIL import Image
from shapely import set_precision, to_geojson
from shapely.geometry import shape

atlas = Path(__file__).resolve().parents[1] / "ui" / "atlas"
source = Path(sys.argv[1])
if hashlib.sha256(source.read_bytes()).hexdigest() != "25230eaa5c82c9e913b9acede197e29e575817e36df9925231c1a1b92a101d8c":
    raise ValueError("Expected Natural Earth GRAY_50M_SR_W.zip")

# Include small islands from the complete local geometries even in the overview.
overview = {}
for file in sorted(atlas.glob("[A-Z][A-Z][A-Z].gz")):
    if file.stem == "ATA":
        continue
    land = shape(json.loads(gzip.decompress(file.read_bytes())))
    overview[file.stem] = json.loads(to_geojson(set_precision(
        land.simplify(.012, preserve_topology=True), .0001, mode="pointwise")))
(atlas / "vote-overview.gz").write_bytes(gzip.compress(
    json.dumps(overview, separators=(",", ":")).encode(), mtime=0))

# EPSG:4326 spans two square tiles across at z0. Neutral sea is transparent.
target = atlas / "vote-relief"
target.mkdir(exist_ok=True)
with ZipFile(source) as archive:
    with archive.open("GRAY_50M_SR_W.tif") as f:
        original = Image.open(f).convert("L")
for zoom in range(3):
    rows = 2 ** zoom
    edge = 512 if zoom < 2 else 1024
    raster = original.resize((2 * rows * edge, rows * edge), Image.Resampling.LANCZOS)
    for y in range(rows):
        for x in range(2 * rows):
            sample = np.asarray(raster.crop((x*edge, y*edge, (x+1)*edge, (y+1)*edge)), dtype=np.int16)
            delta = sample - 177
            rgba = np.zeros((edge, edge, 4), dtype=np.uint8)
            rgba[:, :, :3] = np.where(delta[:, :, None] > 0, 255, 0)
            rgba[:, :, 3] = np.where(sample == 106, 0, np.minimum(np.abs(delta)*2, 120))
            Image.fromarray(rgba).save(target / f"{zoom}-{x}-{y}.webp", quality=84, method=4)
