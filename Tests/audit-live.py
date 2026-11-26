"""Local integration audit. Uses isolated QA products; cleans only its own fixtures.
Requires running API, requests, and sqlcmd with Windows access to local BidNetDb.
Run: py Tests/audit-live.py
"""
import concurrent.futures
import json
import subprocess
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
import requests

BASE = "http://localhost:5014"
PREFIX = "QA-audit-" + uuid.uuid4().hex
created = []
checks = []

def sql(text):
    result = subprocess.run(["sqlcmd", "-S", r".\SQLEXPRESS", "-E", "-C", "-d", "BidNetDb", "-b", "-Q", text], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr + result.stdout)
    return result.stdout

def login(name, password="Demo@12345"):
    r = requests.post(BASE + "/api/auth/login", json={"usernameOrEmail": name, "password": password}, timeout=20)
    r.raise_for_status()
    session = requests.Session()
    session.headers["Authorization"] = "Bearer " + r.json()["accessToken"]
    return session

def check(name, response, expected):
    assert response.status_code in expected, (name, response.status_code, response.text[:300])
    checks.append({"name": name, "status": response.status_code, "passed": True})
    return response

def create(seller, suffix):
    now = datetime.now(timezone.utc)
    payload = {"name": PREFIX + suffix, "startingPrice": 10000,
               "startTime": (now + timedelta(hours=1)).isoformat().replace("+00:00", "Z"),
               "endTime": (now + timedelta(hours=2)).isoformat().replace("+00:00", "Z"), "categoryId": 1}
    r = check("seller creates scheduled auction", seller.post(BASE + "/api/products", json=payload), [201])
    created.append(r.json()["id"])
    return r.json()["id"], payload

try:
    admin = login("admin", "Admin@12345")
    seller = login("seller_demo")
    buyer = login("bidder_demo")
    other = login("bidder_demo2")
    pid, payload = create(seller, "-bid")
    check("support requires login", requests.post(BASE + "/api/support", json={"message": PREFIX}), [401])
    ticket = check("support request persisted", buyer.post(BASE + "/api/support", json={"subject": PREFIX, "message": PREFIX + " help"}), [200]).json()["id"]
    check("ticket privacy", other.get(BASE + f"/api/support/{ticket}"), [404])
    t = check("owner reads conversation", buyer.get(BASE + f"/api/support/{ticket}"), [200]).json()
    check("cannot resolve without response", admin.patch(BASE + f"/api/support/{ticket}/status", json={"status": "Resolved", "version": t["version"]}), [409])
    check("admin replies", admin.post(BASE + f"/api/support/{ticket}/messages", json={"message": "QA response", "version": t["version"]}), [204])
    check("stale reply rejected", buyer.post(BASE + f"/api/support/{ticket}/messages", json={"message": "old", "version": t["version"]}), [409])
    t = buyer.get(BASE + f"/api/support/{ticket}").json()
    check("admin resolves", admin.patch(BASE + f"/api/support/{ticket}/status", json={"status": "Resolved", "version": t["version"]}), [204])
    t = buyer.get(BASE + f"/api/support/{ticket}").json()
    check("owner reopens with reply", buyer.post(BASE + f"/api/support/{ticket}/messages", json={"message": "QA followup", "version": t["version"]}), [204])
    assert buyer.get(BASE + f"/api/support/{ticket}").json()["status"] == "Open"
    check("member cannot read audit", buyer.get(BASE + "/api/admin/audit-logs"), [403])
    logs = check("admin reads audit", admin.get(BASE + "/api/admin/audit-logs?entityType=SupportTicket"), [200]).json()
    assert any(x["entityId"] == ticket for x in logs["items"])
    check("invalid support page", buyer.get(BASE + "/api/support?page=0"), [400])
    assert any(PREFIX in n["message"] for n in admin.get(BASE + "/api/Notifications/me").json())
    check("support empty message rejected", buyer.post(BASE + "/api/support", json={"message": " "}), [400])
    check("admin cannot create", admin.post(BASE + "/api/products", json=payload), [403])
    check("admin cannot bid", admin.post(BASE + f"/api/products/{pid}/bids", json={"amount": 10000}), [403])
    check("anonymous cannot bid", requests.post(BASE + f"/api/products/{pid}/bids", json={"amount": 10000}), [401])
    check("seller cannot self bid", seller.post(BASE + f"/api/products/{pid}/bids", json={"amount": 10000}), [403])
    check("future auction rejects bid", buyer.post(BASE + f"/api/products/{pid}/bids", json={"amount": 10000}), [409])
    check("other cannot edit", other.put(BASE + f"/api/products/{pid}", json=payload), [403])
    check("member cannot cancel", buyer.patch(BASE + f"/api/admin/products/{pid}/cancel", json={"reason": "QA"}), [403])
    check("admin cannot disable self", admin.patch(BASE + "/api/admin/users/1/status", json={"isActive": False}), [400])
    check("in-use category cannot be deleted", admin.delete(BASE + "/api/Categories/1"), [409])
    check("invalid price range", requests.get(BASE + "/api/products?minPrice=9000&maxPrice=1000"), [400])
    check("invalid status", requests.get(BASE + "/api/products?status=invalid"), [400])
    sql(f"UPDATE Products SET StartTime=DATEADD(minute,-1,GETUTCDATE()), EndTime=DATEADD(hour,1,GETUTCDATE()), Status=0 WHERE Id={pid};")
    check("active auction cannot edit", seller.put(BASE + f"/api/products/{pid}", json=payload), [409])
    check("active auction cannot replace photo", seller.post(BASE + f"/api/products/{pid}/images", files={"file": ("test.png", b"test", "image/png")}), [409])
    check("fractional bid rejected", buyer.post(BASE + f"/api/products/{pid}/bids", json={"amount": 10000.5}), [400])
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        replies = list(pool.map(lambda s: s.post(BASE + f"/api/products/{pid}/bids", json={"amount": 10000}), [buyer, other]))
    assert sorted(r.status_code for r in replies)[0] == 201
    assert sum(r.status_code == 201 for r in replies) == 1
    assert all(r.status_code in [201, 400, 409] for r in replies)
    checks.append({"name": "two simultaneous equal bids: exactly one persisted", "passed": True})
    history = requests.get(BASE + f"/api/products/{pid}/bids").json()
    assert history["totalCount"] == 1
    assert all("userId" not in b for b in history["items"])
    detail = requests.get(BASE + f"/api/products/{pid}").json()
    assert detail["minimumBid"] == detail["currentPrice"] + detail["minBidIncrement"]
    winner = buyer if replies[0].status_code == 201 else other
    loser = other if winner is buyer else buyer
    check("repeated same bid rejected", winner.post(BASE + f"/api/products/{pid}/bids", json={"amount": 10000}), [400])
    sql(f"UPDATE Products SET EndTime=DATEADD(second,-1,GETUTCDATE()) WHERE Id={pid};")
    check("expired auction rejects bid before worker", buyer.post(BASE + f"/api/products/{pid}/bids", json={"amount": 20000}), [409])
    check("admin cannot cancel after deadline", admin.patch(BASE + f"/api/admin/products/{pid}/cancel", json={"reason": "QA"}), [409])
    for attempt in range(30):
        detail = requests.get(BASE + f"/api/products/{pid}").json()
        if detail["status"] == "Completed": break
        time.sleep(.5)
    assert detail["status"] == "Completed"
    orders = winner.get(BASE + "/api/Orders/me").json()
    matched = [o for o in orders if o["productId"] == pid]
    assert len(matched) == 1 and matched[0]["finalPrice"] == 10000
    oid = matched[0]["id"]
    check("admin order list", admin.get(BASE + f"/api/Orders?q={oid}"), [200])
    check("member cannot list all orders", winner.get(BASE + "/api/Orders"), [403])
    check("unrelated history forbidden", loser.get(BASE + f"/api/Orders/{oid}/history"), [403])
    assert winner.get(BASE + f"/api/Orders/{oid}/history").json()["items"][0]["action"] == "Created"
    checks.append({"name": "worker closes auction and creates exactly one matching order", "passed": True})
    check("unrelated user cannot read order", loser.get(BASE + f"/api/Orders/{oid}"), [403])
    check("buyer cannot mark paid", winner.patch(BASE + f"/api/Orders/{oid}/status", json={"status": "Paid"}), [403])
    check("seller cannot change buyer address", seller.patch(BASE + f"/api/Orders/{oid}/shipping-address", json={"shippingAddress": "QA address"}), [403])
    check("blank address rejected", winner.patch(BASE + f"/api/Orders/{oid}/shipping-address", json={"shippingAddress": "   "}), [400])
    check("buyer saves address", winner.patch(BASE + f"/api/Orders/{oid}/shipping-address", json={"shippingAddress": "QA audit address"}), [200])
    check("cannot skip paid step", seller.patch(BASE + f"/api/Orders/{oid}/status", json={"status": "Delivered"}), [400])
    # Force both handlers to read the same row version before allowing either write.
    lock = subprocess.Popen(["sqlcmd", "-S", r".\SQLEXPRESS", "-E", "-C", "-d", "BidNetDb", "-b", "-Q",
        f"BEGIN TRAN; SELECT Id FROM Orders WITH (UPDLOCK,ROWLOCK) WHERE Id={oid}; WAITFOR DELAY '00:00:02'; COMMIT;"], stdout=subprocess.DEVNULL)
    time.sleep(.4)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(s.patch, BASE + f"/api/Orders/{oid}/status", json={"status": state, "note": "QA cancellation"}) for s, state in [(seller, "Paid"), (admin, "Cancelled")]]
        transitions = [f.result() for f in futures]
    assert lock.wait(timeout=10) == 0
    assert sum(r.status_code == 200 for r in transitions) == 1, [r.status_code for r in transitions]
    assert all(r.status_code in [200, 400, 409] for r in transitions)
    checks.append({"name": "concurrent order transitions: one writer wins", "passed": True})
    sql(f"UPDATE Orders SET Status=0,CompletedAt=NULL WHERE Id={oid};")
    check("seller confirms receipt of payment", seller.patch(BASE + f"/api/Orders/{oid}/status", json={"status": "Paid"}), [200])
    check("paid order cannot be cancelled without refund flow", seller.patch(BASE + f"/api/Orders/{oid}/status", json={"status": "Cancelled"}), [400])
    delivered = check("seller confirms delivery", seller.patch(BASE + f"/api/Orders/{oid}/status", json={"status": "Delivered"}), [200]).json()
    retried = check("retry delivery is idempotent", seller.patch(BASE + f"/api/Orders/{oid}/status", json={"status": "Delivered"}), [200]).json()
    assert delivered["completedAt"] == retried["completedAt"]
    check("delivered address immutable", winner.patch(BASE + f"/api/Orders/{oid}/shipping-address", json={"shippingAddress": "Other address"}), [409])
    empty_id, _ = create(seller, "-no-bids")
    sql(f"UPDATE Products SET StartTime=DATEADD(hour,-1,GETUTCDATE()),EndTime=DATEADD(second,-1,GETUTCDATE()),Status=0 WHERE Id={empty_id};")
    for attempt in range(30):
        empty = requests.get(BASE + f"/api/products/{empty_id}").json()
        if empty["status"] == "Completed": break
        time.sleep(.5)
    assert empty["status"] == "Completed" and empty["winnerId"] is None
    assert not any(o["productId"] == empty_id for o in seller.get(BASE + "/api/Orders/me").json())
    checks.append({"name": "auction with no bids closes without order or winner", "passed": True})
    out = Path(__file__).resolve().parents[1] / "docs/qa"
    out.mkdir(exist_ok=True)
    (out / "live-audit-results.json").write_text(json.dumps(checks, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"PASS: {len(checks)} live checks on SQL Server")
finally:
    if created:
        ids = ",".join(map(str, created))
        sql(f"""SET XACT_ABORT ON; BEGIN TRAN;
        DELETE FROM Notifications WHERE Message LIKE N'%{PREFIX}%' OR ProductId IN ({ids}) OR OrderId IN (SELECT Id FROM Orders WHERE ProductId IN ({ids})) OR TicketId IN (SELECT Id FROM SupportTickets WHERE Subject=N'{PREFIX}');
        DELETE FROM AdminAuditLogs WHERE (EntityType='SupportTicket' AND EntityId IN (SELECT Id FROM SupportTickets WHERE Subject=N'{PREFIX}')) OR (EntityType='Order' AND EntityId IN (SELECT Id FROM Orders WHERE ProductId IN ({ids})));
        DELETE FROM SupportMessages WHERE TicketId IN (SELECT Id FROM SupportTickets WHERE Subject=N'{PREFIX}');
        DELETE FROM SupportTickets WHERE Subject=N'{PREFIX}';
        DELETE FROM OrderEvents WHERE OrderId IN (SELECT Id FROM Orders WHERE ProductId IN ({ids}));
        DELETE FROM Orders WHERE ProductId IN ({ids}); DELETE FROM Bids WHERE ProductId IN ({ids}); DELETE FROM ProductImages WHERE ProductId IN ({ids}); DELETE FROM Products WHERE Id IN ({ids}) AND Name LIKE N'{PREFIX}%'; COMMIT;""")
        print("Removed isolated QA fixtures.")
