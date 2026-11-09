"""يحدّث جدول دوري أدنوك ونتايجه من TheSportsDB ويكتبها في fixtures.json (يشتغل لحاله في GitHub Actions)."""
import json, time, urllib.request, datetime, os, sys

LEAGUE = "4678"          # دوري أدنوك للمحترفين في TheSportsDB
SEASON = os.environ.get("SEASON", "2026-2027")
API = "https://www.thesportsdb.com/api/v1/json/123"
TEAM = {  # رقم الفريق في المصدر -> مفتاح النادي في اللعبة
    "137832": "ain", "137828": "shabab", "137835": "wasl", "137830": "jazira", "137836": "wahda",
    "137829": "sharjah", "137831": "nasr", "137838": "ajman", "137837": "kalba", "137842": "khorfakkan",
    "137839": "baniyas", "137834": "dhafra", "137841": "hatta", "156157": "united",
}
OUT = os.path.join(os.path.dirname(__file__), "..", "fixtures.json")

def get(url):
    for i in range(3):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "var-el3azy-fixtures"}), timeout=25))
        except Exception as e:
            print("retry", url, e, file=sys.stderr); time.sleep(5)
    return {}

def score(v):
    try: return int(v)
    except (TypeError, ValueError): return None

old = None
try: old = json.load(open(OUT))
except Exception: pass
old_rounds = {r["round"]: r for r in (old or {}).get("rounds", [])}

rounds = []
for r in range(1, 27):
    resp = get(f"{API}/eventsround.php?id={LEAGUE}&r={r}&s={SEASON}")
    ev = resp.get("events") or []
    time.sleep(3)  # المفتاح المجاني: لين 30 طلب بالدقيقة
    # لو المصدر ما رد على هالجولة نخلي اللي عندنا، ما نمسحها
    if not ev:
        if r in old_rounds: rounds.append(old_rounds[r])
        continue
    ms = []
    for e in ev:
        h, a = TEAM.get(e.get("idHomeTeam")), TEAM.get(e.get("idAwayTeam"))
        if not h or not a: continue
        ts = e.get("strTimestamp") or f"{e.get('dateEvent')}T{e.get('strTime') or '00:00:00'}"
        ko = ts.replace("+00:00", "")[:19] + "Z"
        st = (e.get("strStatus") or "").upper()
        done = st in ("FT", "AET", "PEN", "MATCH FINISHED")
        m = {"id": e["idEvent"], "home": h, "away": a, "ko": ko, "status": st or "NS"}
        if done and score(e.get("intHomeScore")) is not None and score(e.get("intAwayScore")) is not None:
            m["hs"], m["as"] = score(e["intHomeScore"]), score(e["intAwayScore"])
        if st in ("PST", "POSTPONED", "CANC", "CANCELLED"): m["postponed"] = True
        ms.append(m)
    if ms:
        ms.sort(key=lambda m: m["ko"])
        rounds.append({"round": r, "matches": ms})

if not rounds:
    print("no data, keep old file"); sys.exit(0)

now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
# الجولة الحالية: أول جولة فيها مباراة ما خلصت
# الجولة الحالية: الجولة اللي فيها أقرب مباراة ما خلصت (بعض الجولات تتأجل وتنلعب بعدين)
pending = sorted((m["ko"], r["round"]) for r in rounds for m in r["matches"] if "hs" not in m and not m.get("postponed"))
current = pending[0][1] if pending else rounds[-1]["round"]
data = {"league": "دوري أدنوك للمحترفين", "season": SEASON, "source": "TheSportsDB", "current": current, "rounds": rounds}

if old and {k: v for k, v in old.items() if k != "updated"} == data:
    print("no change"); sys.exit(0)
data["updated"] = now
json.dump(data, open(OUT, "w"), ensure_ascii=False, indent=1)
print("updated: rounds", len(rounds), "current", current)
