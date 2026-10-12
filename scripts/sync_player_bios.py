"""Import factual biography fields from KKR's public Sports Interactive feed.

Run from any directory: python3 scripts/sync_player_bios.py
Optional --cache-dir PATH reuses previously retrieved source responses.
Stable provider IDs were matched against official 2025/2026 squad lists,
franchise profiles and ICC profiles; expected names prevent identity mixups.
"""
import argparse
import concurrent.futures
from datetime import date, datetime
import json
from pathlib import Path
import re
import unicodedata
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'app/public'


def normalized(name):
    return re.sub('[^a-z]', '', unicodedata.normalize('NFKD', name).lower())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', type=Path)
    args = parser.parse_args()
    ids = json.loads((ROOT / 'scripts/player_bio_ids.json').read_text())
    raw = json.loads((PUBLIC / 'data/ipl.json').read_text())
    assert set(ids) == {p['id'] for p in raw['players']}, 'Biography ID map must cover the entire player pool'
    assert len({v['providerId'] for v in ids.values()}) == len(ids), 'Duplicate biography identity'

    def load(item):
        pid, identity = item
        provider_id = identity['providerId']
        source = f'https://www.kkr.in/cricket/static/json/{provider_id}_json_profile.json'
        cached = args.cache_dir / f'{provider_id}.json' if args.cache_dir else None
        if cached and cached.exists():
            payload = cached.read_bytes()
        else:
            with urllib.request.urlopen(source, timeout=45) as response:
                payload = response.read()
        data = json.loads(payload)
        bio = data['data'][0]['profile']['Bio']
        assert str(bio['Player_Id']) == provider_id, f'Provider ID mismatch: {pid}'
        assert normalized(bio['Player_Name']) == normalized(identity['expectedName']), f'Name mismatch: {pid}'
        born = datetime.strptime(bio['Date_of_Birth'], '%B %d, %Y').date()
        assert 1960 <= born.year <= date.today().year, f'Invalid birth date: {pid}'
        assert bio['Nationality'] and bio['Batting_Style'] not in ('', '-'), f'Incomplete profile: {pid}'
        bowling = bio.get('Bowling_Style', '').strip()
        return pid, {
            'birthDate': born.isoformat(),
            'nationality': bio['Nationality'],
            'battingStyle': bio['Batting_Style'].replace(' Handed', '-handed'),
            'bowlingStyle': bowling if bowling not in ('', '-') else None,
            'source': source,
            'providerId': provider_id,
            'sourceName': bio['Player_Name'],
            'sourceUpdated': data.get('last_updated'),
            'retrievedOn': date.today().isoformat(),
        }

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        profiles = dict(pool.map(load, ids.items()))
    # Publish only after every identity and required field passes validation.
    (PUBLIC / 'data/player-bios.json').write_text(json.dumps(profiles, indent=2) + '\n')
    missing = sum(p['bowlingStyle'] is None for p in profiles.values())
    print(f'Verified {len(profiles)} biographies; {missing} official profiles do not list a bowling style')


if __name__ == '__main__':
    main()
