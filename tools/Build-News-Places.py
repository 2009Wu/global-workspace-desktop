"""Build city-level reporting anchors from GeoNames cities15000.zip (CC BY 4.0)."""
import gzip
import json
import sys
from pathlib import Path
from zipfile import ZipFile

cities = []
with ZipFile(sys.argv[1]) as archive, archive.open("cities15000.txt") as lines:
    for raw in lines:
        f = raw.decode().rstrip("\n").split("\t")
        if f[7] == "PPLX":
            continue
        cities.append([f[1], f[2] if f[1] != f[2] else "", f[8], round(float(f[4]),2), round(float(f[5]),2)])
out = Path(__file__).resolve().parents[1] / "ui/atlas/news-cities.gz"
out.write_bytes(gzip.compress(json.dumps(cities,ensure_ascii=False,separators=(",",":")).encode(),mtime=0))
print(len(cities), "city reference points")
