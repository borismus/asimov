"""Pull the free TRIZ Effects Database (Andrew Martin, Oxford Creativity) into edb.json.

The database answers "how can I <function> a <target>?" with a list of physical effects.
We ask every function x target pair once, politely (one request every 2 s), with effects
only (no applications), and keep each effect once with every function+target it answers.

  python3 scrape_edb.py          writes effects/edb.json, caching raw pages in effects/edb_raw/
"""
import html, json, os, re, subprocess, time

URL = "http://wbam2244.dns-systems.net/EDB/index.php"
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "edb_raw")
UA = {"User-Agent": "Mozilla/5.0 (effects survey)"}

def post(data):
    # curl, not urllib: the server resets urllib's connections
    args = ["curl", "-s", "-m", "60", "-A", UA["User-Agent"]]
    for k, v in data.items(): args += ["--data-urlencode", f"{k}={v}"]
    return subprocess.run(args + [URL], capture_output=True, check=True).stdout.decode("utf-8", "ignore")

def radios(page, name):
    return re.findall(rf"name='{name}' value='(\d+)'[^>]*/>\s*([^<]+)", page)

ROW = re.compile(r"<div class='results-title'><(?:a )?id='a(\d+)'(?: href='([^']*)')?\s*>\s*(.*?)</a></div>\s*"
                 r"<div class='results-desc'>(.*?)</div>\s*<div class='results-note'>(.*?)</div>", re.S)

def clean(s): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()

def main():
    os.makedirs(RAW, exist_ok=True)
    form = post({"PageRequest": "EDBselectTaskTarget", "mode_button": "Function"})
    tasks, targets = radios(form, "selected_task"), radios(form, "selected_target")
    effects = {}
    for tid, task in tasks:
        for gid, target in targets:
            path = os.path.join(RAW, f"{tid}_{gid}.html")
            if not os.path.exists(path):
                page = post({"PageRequest": "EDBdisplayQueryResults", "selected_task": tid, "selected_target": gid,
                             "filter": "effect", "Preserved_Mode_Name": "Function"})
                open(path, "w").write(page); time.sleep(2)
            page = open(path).read()
            n = 0
            for eid, link, name, desc, note in ROW.findall(page):
                e = effects.setdefault(eid, {"id": eid, "name": clean(name), "wiki": link or None,
                                             "desc": clean(desc), "does": []})
                e["does"].append({"function": task.strip(), "target": target.strip(), "note": clean(note) or None})
                n += 1
            print(f"{task.strip():12s} {target.strip():14s} {n:4d}   total {len(effects)}", flush=True)
    out = sorted(effects.values(), key=lambda e: e["name"].lower())
    json.dump(out, open(os.path.join(HERE, "edb.json"), "w"), indent=1, ensure_ascii=False)
    print(f"{len(out)} effects -> edb.json")

if __name__ == "__main__":
    main()
