"""نسخة احتياطية يومية: ياخذ الأسئلة المنشورة من لوحة التحكم (Firebase) ويحفظها في questions.json.
هالملف نفسه هو المصدر الاحتياطي للتطبيق لو Firebase ما رد."""
import json, os, sys, urllib.request, datetime

API_KEY = "AIzaSyAO2QxjZiEqL6NL63syXVQoFeo5ZpqO9xA"
DB = os.environ.get("VAR_DB", "https://var-el3azy-default-rtdb.asia-southeast1.firebasedatabase.app")
AUTH = os.environ.get("VAR_AUTH", "https://identitytoolkit.googleapis.com")
NS = os.environ.get("VAR_NS", "")

def req(url, data=None):
    r = urllib.request.Request(url, data=json.dumps(data).encode() if data is not None else None,
                               headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r, timeout=60) as f:
        return json.loads(f.read())

token = req(f"{AUTH}/v1/accounts:signUp?key={API_KEY}", {"returnSecureToken": True})["idToken"]
try:
    pub = req(f"{DB}/bank/published.json?auth={token}{NS}")
except Exception as e:
    print("ما قدرنا نقرا النسخة المنشورة:", e); sys.exit(0)
if not pub or not isinstance(pub.get("questions"), list) or len(pub["questions"]) < 20:
    print("ما في نسخة منشورة من اللوحة للحين، ما تغير شي"); sys.exit(0)

cur = json.load(open("questions.json", encoding="utf-8"))
if int(pub.get("version", 0)) <= int(cur.get("version", 0)) and len(cur.get("questions", [])) == len(pub["questions"]):
    print("النسخة نفسها، ما تغير شي"); sys.exit(0)

out = {"version": int(pub["version"]), "updated": datetime.date.today().isoformat(), "source_file": "لوحة التحكم",
       "questions": [{k: v for k, v in q.items() if k != "id"} for q in pub["questions"]]}
json.dump(out, open("questions.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"انحفظت النسخة {out['version']} ({len(out['questions'])} سؤال)")
