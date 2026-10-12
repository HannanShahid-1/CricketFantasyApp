"""Refresh official IPL portraits without changing cricket or league data.

Run: python3 scripts/sync_player_media.py
Uses the public squad endpoint used by iplt20.com; prefers 2026, then 2025.
Explicit aliases resolve scorecard abbreviations, never fuzzy photo guesses.
"""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import re
import sys
import struct
import unicodedata
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "app/public"
TEAMS = dict(zip(
    ["CSK", "DC", "GT", "KKR", "LSG", "MI", "PBKS", "RR", "RCB", "SRH"],
    ["chennai-super-kings", "delhi-capitals", "gujarat-titans", "kolkata-knight-riders",
     "lucknow-super-giants", "mumbai-indians", "punjab-kings", "rajasthan-royals",
     "royal-challengers-bengaluru", "sunrisers-hyderabad"],
))
ALIASES = {
    "RK Singh": "Rinku Singh", "CV Varun": "Varun Chakaravarthy",
    "Rasikh Salam": "Rasikh Dar", "SB Dubey": "Shubham Dubey",
    "RG Sharma": "Rohit Sharma", "PVSN Raju": "Pyla Avinash",
    "B Sai Sudharsan": "Sai Sudharsan", "M Shahrukh Khan": "Shahrukh Khan",
    "R Sai Kishore": "Sai Kishore", "M Prasidh Krishna": "Prasidh Krishna",
    "PWH de Silva": "Wanindu Hasaranga", "PWA Mulder": "Wiaan Mulder",
    "PHKD Mendis": "Kamindu Mendis", "Yudhvir Singh": "Yudhvir Singh Charak",
    "KV Sharma": "Karn Sharma", "V Suryavanshi": "Vaibhav Sooryavanshi",
    "PVD Chameera": "Dushmantha Chameera", "MP Yadav": "Mayank Yadav",
    "BKG Mendis": "Kusal Mendis", "SN Khan": "Sarfaraz Khan",
    "MD Choudhary": "Mukul Choudhary", "MD Shanaka": "Dasun Shanaka",
    "SR Dubey": "Saurabh Dubey", "P Simran Singh": "Prabhsimran Singh",
}


def fetch(url):
    with urllib.request.urlopen(url, timeout=45) as response:
        return response.read()


def norm(name):
    return re.sub("[^a-z]", "", unicodedata.normalize("NFKD", name).lower())


def key(name):
    words = name.split()
    return norm(words[0])[0] + norm(words[-1])


def main():
    raw = json.loads((PUBLIC / "data/ipl.json").read_text())
    catalog = {}
    logos = {}
    for season in (2025, 2026):
        def squad(item):
            code, slug = item
            url = f"https://www.iplt20.com/api/bff/cms/teams/{slug}?tab=squad&season={season}"
            return code, slug, json.loads(fetch(url))["data"]
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
            for code, slug, data in pool.map(squad, TEAMS.items()):
                logos[code] = data["teamCrestUrl"]
                for p in data["squad"]["players"]:
                    catalog[p["externalId"]] = {
                        **p, "season": season, "team": code,
                        "source": f"https://www.iplt20.com/teams/{slug}/squad?season={season}",
                    }
    profiles = {}
    franchise = json.loads((ROOT / "scripts/player_media_fallbacks.json").read_text())
    previous_file = PUBLIC / "data/player-media.json"
    previous = json.loads(previous_file.read_text())["players"] if previous_file.exists() else {}
    for player in raw["players"]:
        name = ALIASES.get(player["name"], player["name"])
        exact = [p for p in catalog.values() if norm(p["name"]) == norm(name)]
        matches = exact or [p for p in catalog.values() if key(p["name"]) == key(name)]
        if len(matches) != 1:
            raise ValueError(f"Review identity for {player['name']}: {[p['name'] for p in matches]}")
        p = matches[0]
        profiles[player["id"]] = {
            "fullName": p["name"], "iplId": p["externalId"], "season": p["season"], "team": p["team"],
            "source": p["source"], "imageUrl": p["imageUrlSet"]["small"],
            "originalImageUrl": p["imageUrl"],
            "photo": f"media/players/{player['id']}.png",
        }
    jobs = [(p["photo"], p["imageUrl"], p["originalImageUrl"]) for p in profiles.values()]
    jobs += [(f"media/teams/{code}.svg", url, url) for code, url in logos.items()]

    def download(job):
        path, url, fallback = job
        target = PUBLIC / path
        pid = target.stem
        if '--reuse' in sys.argv and target.exists() and target.stat().st_size > 1000:
            if pid in previous:
                profiles[pid].update(previous[pid])
            elif pid in franchise:
                profiles[pid].update(franchise[pid])
            return path, hashlib.sha256(target.read_bytes()).hexdigest()
        try:
            content = fetch(url)
        except Exception:
            try:
                content = fetch(fallback)
            except Exception as error:
                print(f"Missing {path}: {fallback}: {error}", flush=True)
                return path, ""
        def valid_png(data):
            return data.startswith(b"\x89PNG\r\n\x1a\n") and min(struct.unpack('>II', data[16:24])) >= 100

        if path.endswith(".png") and not valid_png(content):
            if pid in franchise:
                content = fetch(franchise[pid]["imageUrl"])
                profiles[pid].update(franchise[pid])
            if content.startswith(b'\xff\xd8\xff'):
                path = str(Path(path).with_suffix('.jpg'))
                target = PUBLIC / path
                profiles[pid]['photo'] = path
            elif not valid_png(content):
                print(f"Placeholder {path}: {fallback}", flush=True)
                return path, ""
        if path.endswith(".svg") and b"<svg" not in content:
            raise ValueError(f"Invalid logo: {url}")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        return path, hashlib.sha256(content).hexdigest()

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        hashes = dict(pool.map(download, jobs))
    if not all(hashes.values()):
        raise ValueError("Missing images; review the URLs above")
    portrait_hashes = [hashes[p["photo"]] for p in profiles.values()]
    if len(set(portrait_hashes)) != len(portrait_hashes):
        raise ValueError("Duplicate portraits found; review possible placeholders before publishing metadata")
    metadata = {"players": profiles, "teams": {
        code: {"logo": f"media/teams/{code}.svg", "imageUrl": url} for code, url in logos.items()
    }}
    (PUBLIC / "data/player-media.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(f"Verified {len(profiles)} unique portraits and {len(logos)} team logos")


if __name__ == "__main__":
    main()
