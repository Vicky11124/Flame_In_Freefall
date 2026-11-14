"""
Download the public NASA PSI combustion-science metadata and experimental tables into data/raw.
No login is needed: PSI exposes a JSON API and short-lived signed S3 links.

    python scripts/fetch_psi.py && python scripts/build_data.py
"""
import json, os, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
API = "https://psi.nasa.gov/geode-py/ws"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "flame-in-freefall/1.0"})
    return urllib.request.urlopen(req, timeout=120).read()


def main():
    os.makedirs(os.path.join(RAW, "inv"), exist_ok=True)
    os.makedirs(os.path.join(RAW, "csv"), exist_ok=True)
    hits = json.loads(get(f"{API}/repo/search?term=combustion&source=psi&type=investigation"))["hits"]["hits"]
    ids = [h["_source"]["Accession"] for h in hits if h["_source"].get("Research Area") == "Combustion Science"]
    print(f"{len(ids)} combustion investigations")
    for acc in ids:
        inv = json.loads(get(f"{API}/repo/investigations/{acc}"))
        json.dump(inv, open(os.path.join(RAW, "inv", f"{acc}.json"), "w", encoding="utf-8"))
        for t in inv.get("experimentalTable") or []:
            name = t["file_name"]
            link = get(f"{API}/studies/{acc}/download?file={urllib.parse.quote(name)}"
                       f"&version={t.get('version', 1)}&redirect=false").decode().strip().strip('"')
            open(os.path.join(RAW, "csv", name), "wb").write(get(link))
            print(f"  {acc}: {name}")


if __name__ == "__main__":
    main()
