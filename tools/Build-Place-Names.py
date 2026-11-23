"""Enrich the bundled GeoNames district tiles and city labels with language-tagged names.
Usage: python Build-Place-Names.py allCountries.zip alternateNamesV2.zip
Build dependency: opencc-python-reimplemented. GeoNames data is CC BY 4.0.
"""
import gzip
import json
import math
import re
import sys
from collections import defaultdict
from pathlib import Path
from zipfile import ZipFile

from opencc import OpenCC

atlas = Path(__file__).resolve().parents[1] / "ui/atlas"
languages = set("en hi es ar arz fr bn pt id ur ru de ja pcm mr vi te sw tr zh zh-Hant zh-Hans".split())
simplified, traditional = OpenCC("t2s"), OpenCC("s2t")
def load(path):
    return json.loads(gzip.decompress(path.read_bytes()))
def save(path, rows):
    path.write_bytes(gzip.compress(json.dumps(rows, ensure_ascii=False, separators=(",", ":")).encode(), mtime=0))
cells = {p: load(p) for p in (atlas/"districts").glob("*.gz")}
by_point = {(row[3], row[1], row[2]): row for rows in cells.values() for row in rows}
cities = load(atlas/"places.gz")
by_name = defaultdict(list)
for row in cities:
    by_name[row[3].casefold()].append(row)
targets = {}
best = {}
with ZipFile(sys.argv[1]) as archive, archive.open("allCountries.txt") as stream:
    for line in stream:
        f = line.decode().split("\t")
        if f[6]=="A" and f[7] in {"ADM2","ADM3","ADM4"}:
            row=by_point.get((f[1],round(float(f[4]),4),round(float(f[5]),4)))
            if row is not None:
                targets[f[0]]=(row,5,f[8])
        elif f[6]=="P" and f[1].casefold() in by_name:
            for row in by_name[f[1].casefold()]:
                d=(row[1]-float(f[4]))**2+(row[2]-float(f[5]))**2
                if d<0.25 and d<best.get(id(row),(1,None))[0]:
                    best[id(row)]=(d,(f[0],row,f[8]))
for _,(gid,row,cc) in best.values():
    targets[gid]=(row,7,cc)
names=defaultdict(dict)
with ZipFile(sys.argv[2]) as archive, archive.open("alternateNamesV2.txt") as stream:
    for line in stream:
        f=line.decode().rstrip("\r\n").split("\t")
        if f[1] not in targets or len(f)<8 or f[6]=="1" or f[7]=="1": continue
        lang={"zh-CN":"zh-Hans","zh-TW":"zh-Hant"}.get(f[2],f[2])
        if lang not in languages: continue
        rank=(f[4]=="1", f[5]!="1")
        if lang not in names[f[1]] or rank>names[f[1]][lang][0]:
            names[f[1]][lang]=(rank,f[3])
for source in sys.argv[3:]:
    # Optional Wikidata query results: P17 (country), P1566 (GeoNames ID), Chinese label.
    for binding in json.loads(Path(source).read_text(encoding="utf8"))["results"]["bindings"]:
        gid=binding["id"]["value"]
        if gid in targets:
            names[gid].setdefault("zh",((False,True),binding["name"]["value"]))
for gid,(row,idx,cc) in targets.items():
    aliases={k:s for k,(_,s) in names[gid].items()}
    base=aliases.pop("zh","") or (row[4] if idx==5 else "")
    ja=aliases.get("ja","")
    if not base and cc=="JP" and re.fullmatch(r"[一-鿿々ヶケノ之]{2,}",ja): base=ja
    cn=aliases.get("zh-Hans") or base or aliases.get("zh-Hant")
    tw=aliases.get("zh-Hant") or base or aliases.get("zh-Hans")
    if cn: aliases["zh-Hans"]=simplified.convert(cn)
    if tw: aliases["zh-Hant"]=traditional.convert(tw)
    if idx==5: row[idx:]=[aliases,cc]
    else: row[idx:]=[aliases]
for path,rows in cells.items(): save(path,rows)
save(atlas/"places.gz",cities)
print("Localized records",len(names),"matched districts/cities",len(targets),flush=True)

