# Verify every tor-net + key vbox tool via VM whoami Tor.
import importlib.util
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "tools"
if not ROOT.is_dir():
    ROOT = Path(os.environ.get("VM_TOOLS", Path.home() / "vm-tools"))

def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

tn = load("tor_net_mcp", "tor_net_mcp.py")
vb = load("vbox_mcp", "vbox_mcp.py")
results = {}

def run(name, fn, ok_if=None):
    print(f"\n=== {name} ===", flush=True)
    try:
        out = str(fn())
        print(out[:600].replace("\n", " | "), flush=True)
        ok = True
        if ok_if:
            ok = ok_if(out)
        elif name == "ban_check":
            ok = "refused" in out.lower()
        elif out.strip().lower() in {"timeout", "ssh failed"}:
            ok = False
        elif out.startswith("exit 124"):
            ok = False
        results[name] = {"ok": ok, "preview": out[:400]}
    except Exception as e:
        print(f"EXC {e}", flush=True)
        results[name] = {"ok": False, "preview": str(e)}

run("tor_check", tn.tor_check, lambda o: "IsTor" in o and "true" in o.lower())
run("tor_get", lambda: tn.tor_get("https://example.com/", timeout_sec=60), lambda o: "Example Domain" in o or "example" in o.lower())
run("tor_api", lambda: tn.tor_api("https://httpbin.org/get", method="GET", timeout_sec=60), lambda o: "http_code=200" in o or '"url"' in o)
run("tor_search", lambda: tn.tor_search("Python programming language", timeout_sec=90), lambda o: o.startswith("via Tor") and "http" in o)
run("archive_find", lambda: tn.archive_find("nasa apollo", rows=3), lambda o: "archive.org" in o.lower() or "Internet Archive" in o)
run("archive_item", lambda: tn.archive_item("nasa"), lambda o: "title:" in o.lower() or "nasa" in o.lower())
run("archive_wayback", lambda: tn.archive_wayback("https://example.com/", limit=3), lambda o: "Wayback" in o or "web.archive.org" in o)
run("archive_swh", lambda: tn.archive_swh("git"), lambda o: "Software Heritage" in o or "http" in o)
run("archive_save", lambda: tn.archive_save("https://example.com/", name="example-home.html", max_mb=1), lambda o: "exit 0" in o)
run("repo_search", lambda: tn.repo_search("tor browser", forge="github", rows=3), lambda o: "github via Tor" in o.lower() or "★" in o)
run("repo_info", lambda: tn.repo_info("torvalds/linux"), lambda o: "torvalds/linux" in o.lower() and "clone:" in o.lower())
run("ban_check", lambda: tn.tor_search("stolen database fullz"))
run("vbox_info", vb.vbox_info, lambda o: "VMState" in o or "name=" in o)
run("vbox_exec", lambda: vb.vbox_exec("uname -s", timeout_sec=30), lambda o: "Linux" in o)
run("tor_status", vb.tor_status, lambda o: "9050" in o or "IsTor" in o or "true" in o.lower())
run("tor_fetch", lambda: vb.tor_fetch("https://check.torproject.org/api/ip", timeout_sec=40), lambda o: "IsTor" in o)

out = Path(os.environ.get("TOOL_VERIFY_OUT", Path(__file__).resolve().parent / "tool-verify.json"))
out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
failed = [k for k, v in results.items() if not v["ok"]]
print("\n==== SUMMARY ====")
print("OK:", [k for k, v in results.items() if v["ok"]])
print("FAIL:", failed)
sys.exit(1 if failed else 0)

