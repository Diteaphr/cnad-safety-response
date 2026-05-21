# 資料庫表格說明（PostgreSQL）

本文件依 `backend/app/models/` 與 Alembic migration 整理 **cnad-safety-response** 目前使用的關聯式表格。實際欄位以資料庫為準；若有落差請以最新 migration 為主。

---

## 總覽

| 表格 | 用途 |
|------|------|
| `roles` | 系統角色定義（employee / supervisor / admin） |
| `users` | 使用者帳號與基本資料 |
| `user_roles` | 使用者 ↔ 角色（多對多） |
| `departments` | 部門樹（父子關係、可掛部門主管） |
| `user_departments` | 使用者所屬部門（一人可多部門，其中一筆為 primary） |
| `user_notification_preferences` | 每人推播／通知類型開關（與 `users` 1:1） |
| `event_types` | 事件類型目錄（代碼 + 顯示名稱） |
| `events` | 安全／應變事件 |
| `safety_responses` | 使用者對某事件的最新安全回報（語意上「每人每事件一筆」由唯一鍵約束） |
| `notifications` | 對外發送通知的紀錄（FCM／SMS 等 channel，含 idempotency） |

**已移除（歷史）**：`event_departments`（事件與部門的關聯表）已在 migration `20260515_0009` 刪除；事件範圍改由應用層以「全公司員工」等方式處理。

---

## 關聯示意（文字）

- `users` — `user_roles` — `roles`
- `users` — `user_departments` — `departments`（`departments` 可自參考 `parent_department_id`，並可選 `manager_id` → `users`）
- `users` — `user_notification_preferences`（PK = `user_id`）
- `users` — `events`（`created_by`）
- `events` — `event_types`（`event_type_id`）
- `events` — `safety_responses`、`notifications`（皆含 `event_id` + `user_id`）

直屬主管 **不是** `users` 上的欄位：API 的 `managerId` 由 **`departments.manager_id` + 主部門鏈** 在 `UserRepository.derived_manager_id` 等邏輯中推算。

---

## `roles`

| 欄位 | 型別（概念） | 說明 |
|------|----------------|------|
| `role_id` | UUID, PK | 角色主鍵 |
| `role_name` | string, unique | 例如 `employee`、`supervisor`、`admin` |

---

## `users`

| 欄位 | 型別（概念） | 說明 |
|------|----------------|------|
| `user_id` | UUID, PK | 使用者主鍵 |
| `employee_no` | string, unique | 員工編號 |
| `name` | string | 姓名 |
| `email` | string, unique | 登入信箱 |
| `phone` | string, nullable | 電話／手機 |
| `status` | string | 帳號狀態；登入流程會檢查 `active`，停用時為 `inactive` 等 |
| `password_hash` | string, nullable | 密碼雜湊（無密碼或僅 SSO 時可為空） |

**注意**：`users.department_id`、`users.manager_id` 已於 migration `20260516_0010` 移除，改由 **`user_departments`** 與 **`departments.manager_id`** 表達組織與主管關係。

---

## `user_roles`

使用者與角色的關聯表（複合主鍵）。

| 欄位 | 說明 |
|------|------|
| `user_id` | FK → `users.user_id`，ON DELETE CASCADE |
| `role_id` | FK → `roles.role_id`，ON DELETE CASCADE |

---

## `departments`

| 欄位 | 說明 |
|------|------|
| `department_id` | UUID, PK |
| `department_name` | 部門名稱 |
| `parent_department_id` | FK → `departments.department_id`，nullable（根節點無父） |
| `manager_id` | FK → `users.user_id`，nullable（該部門主管；用於直屬／轄下查詢） |

---

## `user_departments`

使用者隸屬部門；支援多部門，並以 **`is_primary`** 標示主部門（API 的「部門」多數指 primary）。

| 欄位 | 說明 |
|------|------|
| `user_department_id` | UUID, PK |
| `user_id` | FK → `users`，CASCADE |
| `department_id` | FK → `departments`，CASCADE |
| `is_primary` | boolean；每位使用者僅能有一筆 `is_primary = true`（partial unique index） |

唯一鍵：`(user_id, department_id)` 不可重複。

---

## `user_notification_preferences`

與 `users` **一對一**（主鍵即 `user_id`）。儲存使用者是否接收各類推播／通知。

| 欄位 | 說明 |
|------|------|
| `user_id` | PK & FK → `users`，CASCADE |
| `push_master_enabled` | 推播總開關 |
| `push_emergency_enabled` | 緊急／啟動類通知 |
| `push_reminder_enabled` | 提醒類 |
| `push_escalation_enabled` | 升級類 |
| `updated_at` | 最後更新時間（timezone-aware） |

---

## `event_types`

事件類型目錄（建立事件時可選內建或自訂類型）。

| 欄位 | 說明 |
|------|------|
| `event_type_id` | UUID, PK |
| `code` | 穩定代碼（unique） |
| `name` | 顯示名稱（對應 API 的 type 字串等） |

---

## `events`

| 欄位 | 說明 |
|------|------|
| `event_id` | UUID, PK |
| `title` | 標題 |
| `event_type_id` | FK → `event_types` |
| `description` | 說明，可為空 |
| `status` | 僅允許 `active` 或 `closed`（DB CHECK，見 migration `20260515_0009`） |
| `created_by` | FK → `users`（建立者） |
| `start_time` | 事件開始時間，可為空 |
| `created_at` | 建立時間，預設 now |

---

## `safety_responses`

使用者對某事件的**安全狀態回報**（平安／需要協助等）。

| 欄位 | 說明 |
|------|------|
| `response_id` | UUID, PK |
| `event_id` | FK → `events`，CASCADE |
| `user_id` | FK → `users`，CASCADE |
| `status` | 應用層使用如 `safe`、`need_help` |
| `comment` | 備註 |
| `location` | 位置描述 |
| `responded_at` | 回報時間 |

**唯一鍵**：`(event_id, user_id)` — 同一使用者對同一事件僅保留一筆邏輯列（更新即覆寫語意由 repository／API 實作）。

---

## `notifications`

對外通道發送紀錄（例如 FCM、SMS），用於 idempotency 與重試／稽核。

| 欄位 | 說明 |
|------|------|
| `notification_id` | UUID, PK |
| `event_id` | FK → `events`，CASCADE |
| `user_id` | FK → `users`，CASCADE |
| `channel` | 通道識別字串（例如 `fcm_activation`、`sms_reminder` 等，依 `notification_dispatch`） |
| `status` | 例如 `pending`、`sent`、`failed`（見 `NotificationService` 常數） |
| `sent_at` | 成功送出時間，可為空 |

**唯一鍵**：`(event_id, user_id, channel)` — 同一事件、同一使用者、同一通道不重複建立「已送出」邏輯。

---

## 維護與種子資料

- Schema 變更：見 `backend/alembic/versions/`。
- 開發用 Demo 資料：`backend/app/seeding/`（與前端 **Demo 靜態 mock** 無關；前端 mock 在 `frontend/src/mockData.ts`）。

若你擴充表格，建議同步更新本檔與 `docs/architecture.md`（若架構文件有提到 persistence）。
