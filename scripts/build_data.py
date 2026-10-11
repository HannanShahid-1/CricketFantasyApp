"""Convert Cricsheet IPL ball-by-ball JSON into the compact data file the app loads.

Usage (run from the repo root; data paths are arguments):
    python -I scripts/build_data.py data/raw/ipl_male_json.zip app/public/data/ipl.json

Output contains two seasons:
  - 2025: used only for pre-draft projections / rankings
  - 2026: the season that gets simulated

Ball encoding (one array per delivery):
  [over, batter, bowler, runsBatter, runsExtras, flags, wicket?]
  flags bitmask: 1 wide, 2 no-ball, 4 bye, 8 leg-bye, 16 penalty, 32 non-boundary
  wicket: [kindCode, playerOut, [fielder, ...]]  (player refs are indexes into `players`)
"""
import collections
import datetime as dt
import json
import sys
import zipfile

SEASONS = ("2025", "2026")
SIM_SEASON = "2026"

TEAMS = {
    "Chennai Super Kings": ("CSK", "#F9CD05", "#0B4EA2"),
    "Delhi Capitals": ("DC", "#2561AE", "#EF1B23"),
    "Gujarat Titans": ("GT", "#1C2C5B", "#B8A06A"),
    "Kolkata Knight Riders": ("KKR", "#3A225D", "#D4AF37"),
    "Lucknow Super Giants": ("LSG", "#0057E2", "#F28B00"),
    "Mumbai Indians": ("MI", "#004BA0", "#D1AB3E"),
    "Punjab Kings": ("PBKS", "#DD1F2D", "#A7A9AC"),
    "Rajasthan Royals": ("RR", "#EA1A85", "#254AA5"),
    "Royal Challengers Bengaluru": ("RCB", "#D11D26", "#2B2A29"),
    "Sunrisers Hyderabad": ("SRH", "#F26522", "#000000"),
}
TEAM_ALIASES = {"Royal Challengers Bangalore": "Royal Challengers Bengaluru", "Kings XI Punjab": "Punjab Kings"}

WICKET_KINDS = [
    "bowled", "caught", "lbw", "stumped", "caught and bowled", "hit wicket",
    "run out", "retired hurt", "retired out", "obstructing the field", "timed out", "handled the ball",
]

# Specialist keepers (Cricsheet names). Anyone who effected a stumping is added automatically.
KNOWN_KEEPERS = {
    "MS Dhoni", "SV Samson", "Urvil Patel", "Kartik Sharma", "KL Rahul", "Abishek Porel", "JC Buttler",
    "Anuj Rawat", "Kumar Kushagra", "Q de Kock", "TL Seifert", "Rahmanullah Gurbaz", "RR Pant", "N Pooran",
    "JP Inglis", "RD Rickelton", "Robin Minz", "P Simran Singh", "Vishnu Vinod", "Dhruv Jurel", "JM Sharma",
    "PD Salt", "H Klaasen", "Ishan Kishan", "KS Bharat", "Aryan Juyal", "A Raghuvanshi", "FH Allen",
}

EXTRA_FLAGS = {"wides": 1, "noballs": 2, "byes": 4, "legbyes": 8, "penalty": 16}


def team_name(name):
    return TEAM_ALIASES.get(name, name)


def load_matches(zip_path):
    z = zipfile.ZipFile(zip_path)
    out = []
    for n in z.namelist():
        if not n.endswith(".json"):
            continue
        d = json.loads(z.read(n))
        if str(d["info"]["season"]) in SEASONS:
            out.append((n.rsplit("/", 1)[-1].replace(".json", ""), d))
    return out


def main(zip_path, out_path):
    raw = load_matches(zip_path)
    players = {}  # registry id -> index
    plist = []  # [{id, name}]
    agg = collections.defaultdict(collections.Counter)  # player index -> counters (both seasons)
    last_team = {}  # player index -> team code in SIM_SEASON

    def pidx(reg, name):
        pid = reg[name]
        if pid not in players:
            players[pid] = len(plist)
            plist.append({"id": pid, "name": name})
        return players[pid]

    seasons = {s: [] for s in SEASONS}
    for file_id, d in raw:
        info = d["info"]
        season = str(info["season"])
        reg = info["registry"]["people"]
        teams = [team_name(t) for t in info["teams"]]
        codes = [TEAMS[t][0] for t in teams]
        ev = info.get("event", {})
        squads = {}
        for t, ps in info["players"].items():
            code = TEAMS[team_name(t)][0]
            squads[code] = [pidx(reg, p) for p in ps]
            for i in squads[code]:
                agg[i]["apps"] += 1
                if season == SIM_SEASON:
                    last_team[i] = code

        innings = []
        for inn in d["innings"]:
            if inn.get("super_over"):
                continue
            balls = []
            pos = {}
            for o in inn["overs"]:
                for dl in o["deliveries"]:
                    b = pidx(reg, dl["batter"])
                    bw = pidx(reg, dl["bowler"])
                    if b not in pos:
                        pos[b] = len(pos) + 1
                    ns = pidx(reg, dl["non_striker"])
                    if ns not in pos:
                        pos[ns] = len(pos) + 1
                    flags = 0
                    for k in dl.get("extras", {}):
                        flags |= EXTRA_FLAGS.get(k, 0)
                    if dl["runs"].get("non_boundary"):
                        flags |= 32
                    ball = [o["over"], b, bw, dl["runs"]["batter"], dl["runs"]["extras"], flags]
                    legal = not (flags & 3)
                    if not flags & 1:
                        agg[b]["bf"] += 1
                    agg[b]["r"] += dl["runs"]["batter"]
                    if legal:
                        agg[bw]["bb"] += 1
                    for w in dl.get("wickets", []):
                        kind = WICKET_KINDS.index(w["kind"]) if w["kind"] in WICKET_KINDS else 7
                        fielders = [pidx(reg, f["name"]) for f in w.get("fielders", []) if f.get("name") in reg]
                        if w["kind"] == "stumped":
                            for f in fielders:
                                agg[f]["st"] += 1
                        ball.append([kind, pidx(reg, w["player_out"]), fielders])
                        break  # at most one wicket per ball in practice
                    balls.append(ball)
            for p, ps in pos.items():
                agg[p]["pos_sum"] += ps
                agg[p]["innings"] += 1
            innings.append({"team": TEAMS[team_name(inn["team"])][0], "balls": balls})

        outcome = info.get("outcome", {})
        result = ""
        if "winner" in outcome:
            by = outcome.get("by", {})
            w = TEAMS[team_name(outcome["winner"])][0]
            if "runs" in by:
                result = f"{w} won by {by['runs']} runs"
            elif "wickets" in by:
                result = f"{w} won by {by['wickets']} wkts"
            else:
                result = f"{w} won"
            if outcome.get("method"):
                result += f" ({outcome['method']})"
        elif outcome.get("result"):
            result = outcome["result"].capitalize()
            if outcome.get("eliminator"):
                result += f" ({TEAMS[team_name(outcome['eliminator'])][0]} won super over)"

        seasons[season].append({
            "id": file_id,
            "num": ev.get("match_number"),
            "stage": ev.get("stage"),
            "date": info["dates"][0],
            "venue": info.get("venue", ""),
            "city": info.get("city", ""),
            "teams": codes,
            "winner": TEAMS[team_name(outcome["winner"])][0] if "winner" in outcome else None,
            "result": result,
            "pom": [players[reg[p]] for p in info.get("player_of_match", []) if p in reg and reg[p] in players],
            "squads": squads,
            "innings": innings,
        })

    # Sort, assign start times (double-headers: afternoon then evening)
    for s, ms in seasons.items():
        ms.sort(key=lambda m: (m["date"], m["num"] if isinstance(m["num"], int) else 999))
        by_day = collections.defaultdict(list)
        for m in ms:
            by_day[m["date"]].append(m)
        for day, dms in by_day.items():
            times = ["19:30"] if len(dms) == 1 else ["15:30", "19:30"]
            for m, t in zip(dms, times):
                m["time"] = t

    # Roles from both seasons combined
    roles = {}
    for i, p in enumerate(plist):
        a = agg[i]
        apps = max(a["apps"], 1)
        overs_pm = a["bb"] / 6 / apps
        avg_pos = a["pos_sum"] / a["innings"] if a["innings"] else 11
        bf_pm = a["bf"] / apps
        if p["name"] in KNOWN_KEEPERS or a["st"] > 0:
            role = "WK"
        elif overs_pm >= 1.0 and avg_pos <= 7 and bf_pm >= 6.5:
            role = "ARB" if (a["r"] / apps) * 0.3 >= overs_pm * 2.2 else "ARW"  # batting vs bowling all-rounder
        elif overs_pm >= 1.2:
            role = "BOWL"
        elif overs_pm >= 0.75 and avg_pos <= 7:
            role = "ARB"
        else:
            role = "BAT"
        roles[i] = role

    for i, p in enumerate(plist):
        p["role"] = roles[i]
        p["team"] = last_team.get(i)

    # Gameweeks: Mon-Sun, opening weekend merged into week 1, league stage only
    league = [m for m in seasons[SIM_SEASON] if isinstance(m["num"], int)]
    first = dt.date.fromisoformat(league[0]["date"])
    monday = first - dt.timedelta(days=first.weekday())
    week_of = {}
    for m in league:
        d = dt.date.fromisoformat(m["date"])
        w = (d - monday).days // 7
        week_of[m["id"]] = w
    # merge a partial first week (fewer than 6 matches) into the next one
    first_count = sum(1 for v in week_of.values() if v == 0)
    shift = 1 if first_count < 6 else 0
    gameweeks = collections.defaultdict(list)
    for m in league:
        gw = max(week_of[m["id"]] - shift, 0) + 1
        m["gw"] = gw
        gameweeks[gw].append(m["id"])
    gw_meta = []
    for gw in sorted(gameweeks):
        ms = [m for m in league if m["gw"] == gw]
        gw_meta.append({"gw": gw, "start": ms[0]["date"], "end": ms[-1]["date"], "matches": gameweeks[gw]})

    out = {
        "source": "Cricsheet (cricsheet.org), ODC-BY licence",
        "simSeason": SIM_SEASON,
        "teams": [{"code": c, "name": n, "color": col, "accent": acc} for n, (c, col, acc) in TEAMS.items()],
        "players": plist,
        "seasons": seasons,
        "gameweeks": gw_meta,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))

    # Summary
    pool = [p for p in plist if p["team"]]
    print("players total", len(plist), "in", SIM_SEASON, len(pool))
    print("roles", collections.Counter(p["role"] for p in pool))
    for g in gw_meta:
        print("GW", g["gw"], g["start"], g["end"], len(g["matches"]))
    print("WK:", sorted((p["team"], p["name"]) for p in pool if p["role"] == "WK"))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
