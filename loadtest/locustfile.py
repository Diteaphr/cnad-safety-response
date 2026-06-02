"""
Employee Safety Response — 壓力測試腳本

情境：災害發生後，大量員工同時湧入回報安全狀態
測試目標端點：POST /api/reports（主要）、GET /api/reports/me（次要）

執行前請先跑 setup_test_data.py 產生 test_context.json

用法：
  # Web UI 模式（推薦新手，有圖表）
  locust -f loadtest/locustfile.py --host https://your-url

  # Headless 模式（CI / 快速取數據）
  locust -f loadtest/locustfile.py --headless \
         -u 300 -r 30 --run-time 3m \
         --host https://your-url \
         --html loadtest/report.html \
         --csv  loadtest/results
"""

import json
import random

from locust import HttpUser, between, events, task
from locust.runners import MasterRunner

# ── 讀取測試設定 ───────────────────────────────────────────────────────
try:
    with open("loadtest/test_context.json") as f:
        _CTX = json.load(f)
    EVENT_ID = _CTX["event_id"]
    _TOKENS  = _CTX["tokens"]           # [{"userId": ..., "token": ...}, ...]
except FileNotFoundError:
    raise SystemExit("❌ 找不到 loadtest/test_context.json，請先執行 setup_test_data.py")

print(f"✅ 載入設定：event_id={EVENT_ID}，可用 token={len(_TOKENS)} 個")


# ── 主要使用者行為：員工回報 ────────────────────────────────────────────
class ReportingEmployee(HttpUser):
    """
    模擬一位員工：收到通知後，打開 app 回報平安或需要協助。
    大多數人在被提醒後的短時間內回報，所以 wait_time 偏短。
    """
    wait_time = between(0.5, 3)   # 每次請求之間等待 0.5~3 秒（模擬真實操作延遲）

    def on_start(self):
        """每個虛擬使用者啟動時，隨機分配一個帳號的 token"""
        user = random.choice(_TOKENS)
        self.user_id = user["userId"]
        self.headers = {"Authorization": f"Bearer {user['token']}"}
        self._submitted = False

    # ── 任務定義 ─────────────────────────────────────────────────────
    # @task(weight) 中的數字代表被執行的相對頻率
    # 例如 @task(8) vs @task(2) → 80% 的請求打 submit_report

    @task(8)
    def submit_report(self):
        """回報安全狀態（最主要的壓力來源）"""
        status = random.choices(
            ["safe", "need_help"],
            weights=[92, 8],   # 現實中 92% 平安，8% 需要協助
        )[0]

        payload = {
            "eventId": EVENT_ID,
            "userId":  self.user_id,
            "status":  status,
        }
        if status == "need_help":
            payload["comment"]  = "測試需要協助回報"
            payload["location"] = "B棟 3F"

        with self.client.post(
            "/api/reports",
            json=payload,
            headers=self.headers,
            name="POST /api/reports",   # Locust 圖表上顯示的名稱
            catch_response=True,        # 手動控制成功/失敗判斷
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            else:
                # 標記失敗並附上錯誤訊息（方便 debug）
                resp.failure(f"HTTP {resp.status_code}: {resp.text[:100]}")

    @task(2)
    def view_my_reports(self):
        """查看自己的回報紀錄（讀取壓力）"""
        with self.client.get(
            "/api/reports/me",
            headers=self.headers,
            name="GET /api/reports/me",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            else:
                resp.failure(f"HTTP {resp.status_code}")


# ── 次要使用者行為：主管看儀表板 ───────────────────────────────────────
class SupervisorViewer(HttpUser):
    """
    模擬主管在事件期間持續刷新儀表板查看狀況
    比例設定：80% 員工 + 20% 主管（見下方 weight）
    """
    wait_time = between(5, 15)   # 主管刷新頻率比員工低

    def on_start(self):
        user = random.choice(_TOKENS)
        self.headers = {"Authorization": f"Bearer {user['token']}"}
        # 簡化：用任意 token 打 supervisor dashboard（實際上非主管會被 403）
        # 壓測目的是測 API 吞吐量，403 也算有效回應

    @task
    def view_supervisor_dashboard(self):
        with self.client.get(
            f"/api/dashboard/supervisor?event_id={EVENT_ID}",
            headers=self.headers,
            name="GET /dashboard/supervisor",
            catch_response=True,
        ) as resp:
            # 200 = 主管看到資料，403 = 員工沒權限，都是「正常」回應
            if resp.status_code in (200, 403):
                resp.success()
            else:
                resp.failure(f"HTTP {resp.status_code}")


# ── 測試事件 hook：開始/結束時印出資訊 ────────────────────────────────
@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print(f"\n🚀 壓力測試開始 | event_id={EVENT_ID} | tokens={len(_TOKENS)}")

@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    stats = environment.stats.total
    print(f"\n{'='*60}")
    print(f"📊 測試結束摘要")
    print(f"   總請求數    : {stats.num_requests:,}")
    print(f"   失敗數      : {stats.num_failures:,}")
    print(f"   平均 RPS    : {stats.current_rps:.1f}")
    print(f"   p50 延遲    : {stats.get_response_time_percentile(0.50):.0f} ms")
    print(f"   p95 延遲    : {stats.get_response_time_percentile(0.95):.0f} ms")
    print(f"   p99 延遲    : {stats.get_response_time_percentile(0.99):.0f} ms")
    print(f"{'='*60}\n")
