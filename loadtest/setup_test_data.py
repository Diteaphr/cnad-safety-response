"""
壓力測試前置設定腳本
執行一次即可，會產生 test_context.json 供 Locust 使用

用法：
  python setup_test_data.py --host https://your-cloud-run-url
  python setup_test_data.py --host http://localhost:8000   # 本地測試
"""

import argparse
import json
import sys

import requests

# ── 設定 ──────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument("--host", required=True, help="API base URL（不含結尾斜線）")
parser.add_argument("--admin-email",    default="admin@example.com")
parser.add_argument("--admin-password", default="yourpassword")
parser.add_argument("--event-title",    default="【壓測用】地震安全確認")
args = parser.parse_args()

HOST = args.host.rstrip("/")
OUT  = "loadtest/test_context.json"


def step(msg: str) -> None:
    print(f"\n{'─'*50}\n▶ {msg}")


# ── Step 1：管理員登入，取得 token ────────────────────────────────────
step("管理員登入")
resp = requests.post(f"{HOST}/api/auth/login", json={
    "email":    args.admin_email,
    "password": args.admin_password,
})
if resp.status_code != 200:
    print(f"❌ 登入失敗：{resp.status_code} {resp.text}")
    sys.exit(1)

admin_token = resp.json()["access_token"]
admin_headers = {"Authorization": f"Bearer {admin_token}"}
print(f"✅ 取得 admin token（{admin_token[:30]}...）")


# ── Step 2：建立測試事件 ───────────────────────────────────────────────
step("建立壓測事件")
import datetime
resp = requests.post(f"{HOST}/api/events", headers=admin_headers, json={
    "title":               args.event_title,
    "type":                "Earthquake",
    "description":         "壓力測試用，請忽略",
    "startAt":             datetime.datetime.utcnow().isoformat() + "Z",
    "targetDepartmentIds": [],
})
if resp.status_code != 200:
    print(f"❌ 建立事件失敗：{resp.status_code} {resp.text}")
    sys.exit(1)

event_id = resp.json()["event"]["id"]
print(f"✅ 事件 ID：{event_id}")


# ── Step 3：取得所有使用者清單 ─────────────────────────────────────────
step("取得使用者清單")
resp = requests.get(f"{HOST}/api/users")
users = resp.json().get("users", [])
print(f"✅ 找到 {len(users)} 位使用者")

TARGET_USERS = 500   # 目標帳號數，建議 >= 壓測 -u 值的一半

if len(users) < TARGET_USERS:
    need = TARGET_USERS - len(users)
    print(f"⚠️  使用者數量不足（{len(users)} < {TARGET_USERS}），正在建立 {need} 個測試帳號…")
    import uuid as _uuid
    created = 0
    for i in range(need):
        emp_no = f"LT{str(i+1).zfill(5)}"
        payload = {
            "employeeNo": emp_no,
            "name": f"LoadTest User {i+1}",
            "email": f"loadtest_{i+1}@loadtest.internal",
            "phone": f"+886900{str(i+1).zfill(6)}",
            "roles": ["employee"],
            "departmentId": "",
        }
        r = requests.post(f"{HOST}/api/admin/users",
                          headers=admin_headers, json=payload)
        if r.status_code == 200:
            created += 1
        else:
            pass  # 帳號已存在或其他錯誤，跳過
        if (i + 1) % 20 == 0:
            print(f"   建立 {i+1}/{need}…")
    print(f"✅ 建立了 {created} 個測試帳號")
    # 重新抓取完整清單
    resp = requests.get(f"{HOST}/api/users")
    users = resp.json().get("users", [])
    print(f"✅ 現在共有 {len(users)} 位使用者")


# ── Step 4：為每位使用者取得 token（一般登入）────────────────────────
step("取得每位使用者的 token（POST /api/auth/login）")
USER_PASSWORD = "password"   # 種子資料的預設密碼
LT_PASSWORD = "password"     # admin_create_user 預設密碼 = 員工編號，loadtest 帳號也用 emp_no
tokens = []
failed = 0
for i, u in enumerate(users):
    email = u.get("email", "")
    if not email:
        failed += 1
        continue
    # loadtest 帳號的初始密碼是員工編號（見 portal_service.admin_create_user）
    emp_no = u.get("employeeCode") or u.get("employeeNo", "")
    pwd = emp_no if email.endswith("@loadtest.internal") and emp_no else USER_PASSWORD
    r = requests.post(f"{HOST}/api/auth/login",
                      json={"email": email, "password": pwd})
    if r.status_code == 200:
        tokens.append({"userId": u["id"], "token": r.json()["access_token"]})
    else:
        failed += 1
    # 每 20 個印一次進度
    if (i + 1) % 20 == 0:
        print(f"   {i+1}/{len(users)} 完成…")

print(f"✅ 成功取得 {len(tokens)} 個 token（失敗 {failed} 個）")
if not tokens:
    print("❌ 沒有任何可用 token，請確認帳號密碼正確")
    sys.exit(1)


# ── Step 5：儲存設定 ───────────────────────────────────────────────────
step("儲存測試設定")
context = {
    "host":     HOST,
    "event_id": event_id,
    "tokens":   tokens,
}
with open(OUT, "w") as f:
    json.dump(context, f, indent=2, ensure_ascii=False)

print(f"✅ 已儲存至 {OUT}")
print(f"\n{'='*50}")
print(f"  事件 ID  : {event_id}")
print(f"  使用者數 : {len(tokens)}")
print(f"  下一步   : 執行 locust --host {HOST}")
print(f"{'='*50}")
