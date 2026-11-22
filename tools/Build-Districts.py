"""Build offline administrative labels from the GeoNames allCountries.zip export.

Input: https://download.geonames.org/export/dump/allCountries.zip (CC BY 4.0).
Run with the ZIP path as the sole argument. Every label is an administrative
feature's representative point, used for map typography only.
"""
import gzip
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from zipfile import ZipFile

out = Path(__file__).resolve().parents[1] / "ui/atlas/districts"
out.mkdir(parents=True, exist_ok=True)
groups = defaultdict(list)
han = re.compile(r"[\u3400-\u9fff·]{2,}")
with ZipFile(sys.argv[1]) as src, src.open("allCountries.txt") as stream:
    for raw in stream:
        fields = raw.decode("utf-8").rstrip("\n").split("\t")
        if fields[6] != "A" or fields[7] not in ("ADM2", "ADM3", "ADM4"):
            continue
        level = int(fields[7][-1])
        if level == 4 and fields[8] not in ("CN", "TW"):
            continue
        lat, lon = float(fields[4]), float(fields[5])
        key = f"{int((lon+180)//15)}-{int((lat+90)//15)}"
        zh = ""
        if fields[8] in ("CN", "TW", "HK", "MO"):
            zh = next((s for s in fields[3].split(",") if han.fullmatch(s)), "")
        groups[key].append([level,round(lat,4),round(lon,4),fields[1],zh])
for key, places in groups.items():
    encoded = json.dumps(sorted(places), ensure_ascii=False, separators=(",", ":")).encode()
    (out / (key + ".gz")).write_bytes(gzip.compress(encoded, compresslevel=9, mtime=0))
(out / "index.js").write_text("const districtCells=new Set("+json.dumps(sorted(groups))+");\n",encoding="utf8")
print(sum(map(len,groups.values())), "administrative labels in",len(groups),"cells")

