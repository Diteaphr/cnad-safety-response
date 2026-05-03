#!/usr/bin/env python3
"""
【開發用、一次性 CLI】把資料庫業務資料清掉並重灌種子假資料。

這不是後端「常駐」功能：
- FastAPI startup / lifespan **不會**呼叫重灌；
- **沒有** HTTP endpoint；
需要時 **你本人在終端機手動執行一次**即可。

用法（在 backend/ 目錄）::
    PYTHONPATH=. python scripts/dev_reseed_demo.py

若已安裝 uv::
    uv run python scripts/dev_reseed_demo.py
"""

from __future__ import annotations

import sys
from pathlib import Path

_backend_root = Path(__file__).resolve().parent.parent
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.core.database import SessionLocal  # noqa: E402
from app.seeding.seed_demo import reset_and_seed_demo  # noqa: E402


def main() -> int:
    db = SessionLocal()
    try:
        reset_and_seed_demo(db)
    finally:
        db.close()
    print("Demo data reseeded OK (manual dev CLI).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
