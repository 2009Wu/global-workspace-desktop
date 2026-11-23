"""Bake the desktop globe from the same bundled geography as the detailed map."""
import gzip
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

atlas = Path(__file__).resolve().parents[1] / "ui" / "atlas"
width, height = 8192, 4096

def data(path):
    with gzip.open(path, "rt", encoding="utf-8") as file:
        return json.load(file)

def paths(geometry):
    coords = geometry["coordinates"]
    kind = geometry["type"]
    if kind == "MultiPolygon":
        return [ring for polygon in coords for ring in polygon]
    return [coords] if kind == "LineString" else coords

def points(ring):
    return [((lon + 180) * width / 360, (90 - lat) * height / 180) for lon, lat in ring]

# Retain the native horizontal resolution of the eight terrain tiles per row.
lat = np.radians(90 - (np.arange(height) + .5) * 180 / height)
rows = np.clip((1 - np.arcsinh(np.tan(lat)) / np.pi) * width / 2, 0, width - 1).astype(int)
terrain = np.empty((height, width), np.uint8)
for x in range(8):
    column = np.concatenate([np.asarray(Image.open(atlas / f"relief-3-{x}-{y}.webp").convert("L")) for y in range(8)])
    terrain[:, x*1024:(x+1)*1024] = column[rows]

mask = Image.new("L", (width, height))
land = ImageDraw.Draw(mask)
borders = []
for file in sorted(atlas.glob("*.gz")):
    if not file.stem.isupper() or file.stem.startswith("CN-"):
        continue
    geometry = data(file)
    polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
    for polygon in polygons:
        for index, ring in enumerate(polygon):
            line = points(ring)
            if len(line) < 3:
                continue
            land.polygon(line, fill=0 if index else 255)
            borders.append(line)

# A restrained slate palette preserves relief contrast under event markers.
shade = np.clip(terrain.astype(np.float32) - 47, -32, 72)
rgb = np.stack([np.clip(base + gain * shade, 0, 255).astype("uint8")
                for base, gain in [(37, .55), (54, .62), (60, .65)]], axis=-1)
earth = Image.new("RGB", (width, height), (21, 41, 54))
earth.paste(Image.fromarray(rgb), mask=mask)
grid = ImageDraw.Draw(earth, "RGBA")
for lon in range(-165, 180, 15):
    x = (lon + 180) * width / 360
    grid.line((x, 0, x, height), fill=(160, 197, 211, 19))
for lat in range(-75, 90, 15):
    y = (90 - lat) * height / 180
    grid.line((0, y, width, y), fill=(160, 197, 211, 19))
draw = ImageDraw.Draw(earth)
for name, color in [("admin1", (67, 85, 92)), ("rivers", (51, 85, 100)), ("lakes", (26, 55, 70))]:
    for feature in data(atlas / (name + ".gz")):
        for ring in paths(feature["geometry"]):
            line = points(ring)
            if len(line) < 2:
                continue
            if name == "lakes" and len(line) >= 3:
                draw.polygon(line, fill=color)
            else:
                draw.line(line, fill=color, width=1)
for line in borders:
    draw.line(line, fill=(96, 118, 125), width=2)
for size in (1024, 4096, 8192):
    image = earth if size == width else earth.resize((size, size//2), Image.Resampling.LANCZOS)
    image.save(atlas / f"globe-{size}.webp", quality=93, method=4)
