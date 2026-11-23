"""Build offline UN General Assembly roll calls from the official CSV and recent MARCXML export.
Usage: python tools/Build-Votes.py votes_ga.csv recent.xml
See tools/data/SOURCES.md for provenance and the export query.
"""
import csv
import json
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

out = Path(__file__).resolve().parents[1] / "ui" / "atlas"
choices = "YNAX"
totals = ["total_yes", "total_no", "total_abstentions", "total_non_voting"]
records = {}
with open(sys.argv[1], newline="", encoding="utf-8-sig") as source:
    for row in csv.DictReader(source):
        if row["date"] < "2015-01-01":
            continue
        key = row["undl_id"]
        if key not in records:
            title = row["title"].split(" : resolution /")[0]
            records[key] = dict(id=key, symbol=row["resolution"], date=row["date"], title=title,
                                votes={}, counts=[int(float(row[col])) for col in totals])
        record = records[key]
        code = row["ms_code"]
        if code in record["votes"] or row["ms_vote"] not in choices:
            raise ValueError(f"Invalid vote in {key}: {code}")
        record["votes"][code] = row["ms_vote"]
for key, record in records.items():
    votes = record.pop("votes")
    record["groups"] = [" ".join(sorted(cc for cc, v in votes.items() if v == choice)) for choice in choices]
    if [len(codes.split()) for codes in record["groups"]] != record["counts"]:
        raise ValueError(f"Official totals disagree in {key}")
if not records:
    raise ValueError("No recorded votes found")
(out / "ga-votes.json").write_text(json.dumps(list(records.values()), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

# Keep the fields read by the desktop parser, including official native-language titles.
ns = "http://www.loc.gov/MARC21/slim"
ET.register_namespace("", ns)
tree = ET.parse(sys.argv[2])
fields = {"245": "a", "767": "9t", "791": "a", "967": "cd", "992": "a", "996": "bcdef"}
for record in tree.getroot():
    for field in list(record):
        tag = field.get("tag")
        if tag == "001":
            continue
        if tag not in fields:
            record.remove(field)
            continue
        field.attrib = {"tag":tag}
        for sub in list(field):
            if sub.get("code") not in fields[tag]:
                field.remove(sub)
for node in tree.iter():
    node.tail = None
    if node.text and not node.text.strip():
        node.text = None
tree.write(out / "ga-recent.xml", encoding="utf-8", xml_declaration=True)
print(f"Archived {len(records)} roll calls plus {len(tree.getroot())} recent source records")

