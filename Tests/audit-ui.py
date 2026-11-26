"""Browser audit: roles x light/dark x desktop/mobile, with screenshots and errors."""
import json
import re
import time
from pathlib import Path
import requests
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/qa"
SHOTS = Path(r"C:\Users\works\AppData\Local\Temp\opencode\bidnet-workflow-audit")
OUT.mkdir(exist_ok=True)
SHOTS.mkdir(exist_ok=True)
sessions = {"guest": None}
for role, username, password in [("admin", "admin", "Admin@12345"), ("buyer", "bidder_demo", "Demo@12345"), ("seller", "seller_demo", "Demo@12345")]:
    for attempt in range(7):
        r = requests.post("http://localhost:5014/api/auth/login", json={"usernameOrEmail": username, "password": password})
        if r.status_code != 429:
            break
        time.sleep(10)
    r.raise_for_status()
    sessions[role] = r.json()

routes = {
    "guest": ["/", "/auctions", "/product/1", "/product/10", "/product/12", "/product/16", "/login", "/register", "/news", "/guides", "/guides/quy-tac-dau-gia", "/policies", "/about", "/contact", "/favorites"],
    "buyer": ["/product/1", "/orders", "/order/1", "/my-bids", "/profile", "/notifications", "/admin", "/contact"],
    "seller": ["/product/1", "/my-products", "/product/new", "/product/10/edit"],
    "admin": ["/admin", "/admin/users", "/admin/auctions", "/admin/categories", "/admin/orders", "/admin/diagnostics", "/product/1", "/product/new", "/my-bids"]
}
results = []
content = (ROOT / "frontend/src/content.js").read_text(encoding="utf-8")
for section, block in zip(["news", "guides", "policies"], re.split(r"export const (?:news|guides|policies)\s*=", content)[1:]):
    routes["guest"].extend(f"/{section}/{slug}" for slug in re.findall(r'slug:\s*"([^"]+)"', block))
routes["guest"].extend(["/products", "/auctions?status=Active&sort=ending_soon", "/missing", "/news/missing", "/policies/missing"])
routes["admin"].extend(["/admin/products", "/admin/users?test=1", "/admin/notifications", "/admin/missing", "/profile"])
routes["admin"].extend(["/admin/support", "/admin/audit-logs"])
routes["buyer"].append("/support")
with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    for role, session in sessions.items():
        for theme in ["light", "dark"]:
            for width in [390, 768, 1440]:
                context = browser.new_context(viewport={"width": width, "height": 960})
                context.add_init_script(f"localStorage.setItem('bidnet.theme',{json.dumps(theme)});sessionStorage.setItem('bidnet.session',{json.dumps(json.dumps(session))});")
                page = context.new_page()
                errors, failed = [], []
                page.on("pageerror", lambda e: errors.append(str(e)))
                page.on("response", lambda r: failed.append({"url": r.url, "status": r.status}) if r.status >= 400 else None)
                for route in routes[role]:
                    errors.clear()
                    failed.clear()
                    page.goto("http://localhost:3000/#" + route, wait_until="networkidle")
                    page.wait_for_timeout(180)
                    overflow = page.evaluate("document.documentElement.scrollWidth > innerWidth")
                    broken = page.locator("img").evaluate_all("els=>els.filter(e=>e.complete && !e.naturalWidth).map(e=>e.src)")
                    result = {"role": role, "theme": theme, "width": width, "route": route, "overflow": overflow,
                              "errors": errors.copy(), "failed": failed.copy(), "brokenImages": broken}
                    if route == "/product/1":
                        result["bidPermissionCorrect"] = page.locator("#amount").count() == (1 if role == "buyer" else 0)
                    if role == "admin" and route == "/product/new":
                        result["adminCreateBlocked"] = page.locator('input[name="startingPrice"]').count() == 0
                    if route == "/profile":
                        result["profileAttributes"] = all(page.locator(selector).count() == 1 for selector in [
                            '#fullName', '#phoneNumber', '#dateOfBirth', '#gender', '#contactAddress',
                            '#currentPassword', '#newPassword', '#confirmPassword', 'input[type=file]'])
                    result["passed"] = not overflow and not errors and not failed and not broken and result.get("bidPermissionCorrect", True) and result.get("adminCreateBlocked", True) and result.get("profileAttributes", True)
                    results.append(result)
                    if role == "admin" and route == "/admin/categories":
                        trigger = page.get_by_role("button", name="+ Thêm danh mục")
                        trigger.click()
                        page.locator("dialog[open]").wait_for()
                        assert page.locator("#catName").evaluate("el=>el===document.activeElement")
                        page.keyboard.press("Escape")
                        assert page.locator("dialog[open]").count() == 0
                        assert trigger.evaluate("el=>el===document.activeElement")
                        page.get_by_role("button", name="Sửa", exact=True).first.click()
                        page.locator("dialog[open]").wait_for()
                        assert page.locator("#catName").input_value()
                        page.get_by_role("button", name="Quay lại", exact=True).click()
                    if route in ["/", "/product/1", "/admin/categories", "/login"]:
                        page.evaluate("document.querySelectorAll('img').forEach(i=>i.loading='eager')")
                        page.wait_for_function("Array.from(document.images).every(i=>i.complete)")
                        page.screenshot(path=str(SHOTS / f"{role}-{theme}-{width}-{route.replace('/', '-') or 'home'}.png"), full_page=True)
                context.close()
    browser.close()
(OUT / "ui-audit-results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
bad = [r for r in results if not r["passed"]]
print(json.dumps({"checks": len(results), "passed": len(results)-len(bad), "failures": bad}, ensure_ascii=True, indent=2))
assert not bad, "UI audit failures; see docs/qa/ui-audit-results.json"
