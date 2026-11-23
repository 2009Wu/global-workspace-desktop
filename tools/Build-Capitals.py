"""Build the offline capital clock index from GeoNames dumps (CC BY 4.0).
Usage: python Build-Capitals.py countryInfo.txt allCountries.zip alternateNamesV2.zip
"""
import json
import sys
from pathlib import Path
from zipfile import ZipFile

def rows(archive, member):
    with ZipFile(archive) as z, z.open(member) as src:
        for line in src:
            yield line.decode("utf-8").rstrip("\r\n").split("\t")

info = {}
for line in Path(sys.argv[1]).read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#"):
        cols = line.split("\t")
        if cols[4]:
            info[cols[0]] = cols[4]
capitals = {}
for row in rows(sys.argv[2], "allCountries.txt"):
    if row[7] != "PPLC" or row[8] not in info or not row[17]:
        continue
    score = info[row[8]].casefold() in {s.casefold() for s in [row[1], row[2], *row[3].split(",")]}
    if row[8] not in capitals or score > capitals[row[8]][0]:
        capitals[row[8]] = (score, row[0], row[1], row[17])
names = {c[1]: {} for c in capitals.values()}
languages = set("en zh zh-CN zh-TW zh-Hans zh-Hant fr de es ar hi bn pt id ur ru ja pcm arz mr vi te sw tr".split())
for row in rows(sys.argv[3], "alternateNamesV2.txt"):
    if len(row)<8 or row[1] not in names or row[2] not in languages or row[6] or row[7]:
        continue
    entries = names[row[1]]
    if row[2] not in entries or row[4]=="1":
        entries[row[2]] = row[3]
out = {}
for code, (_, gid, name, zone) in sorted(capitals.items()):
    locales = names[gid]
    for old, new in [("zh-CN","zh-Hans"),("zh-TW","zh-Hant")]:
        if old in locales:
            locales.setdefault(new, locales.pop(old))
    out[code] = {"name":name,"zone":zone,"id":gid,"names":locales}
path = Path(__file__).resolve().parents[1]/"ui"/"atlas"/"capitals.json"
path.write_text(json.dumps(out,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
print(f"Wrote {len(out)} capital clocks")
