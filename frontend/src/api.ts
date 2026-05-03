import { fetchWithTimeout, isProbablyTransientNetworkError, withRetries } from './lib/httpClient';
import type { Department, EventItem, Role, SafetyResponse, User } from './types';

/** `/api/dashboard/supervisor` 回傳之 team 項目 */
export type SupervisorTeamMemberApi = {
  user_id: string;
  name: string;
  department: string;
  status: string;
  reported_at: string | null;
  needs_follow_up: boolean;
  phone?: string | null;
};

export type SupervisorDashboardApi = {
  event: EventItem | null;
  kpis: { safe: number; need_help: number; responded: number; pending: number };
  team: SupervisorTeamMemberApi[];
};

export type AdminDeptStatApi = {
  department: string;
  safe: number;
  need_help: number;
  pending: number;
};

export type AdminDashboardApi = {
  event: EventItem | null;
  kpis: { safe: number; need_help: number; responded: number; pending: number; targeted: number };
  departments: AdminDeptStatApi[];
};

export type PortalNotificationRow = {
  id: string;
  eventId: string;
  channel: string;
  status: string;
  sentAt: string | null;
};

export type FailedNotificationRow = {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  department: string | null;
  channel: string;
  status: string;
  sentAt: string | null;
};

/**
 * 後端 API 路徑皆以 `/api/...` 開頭；基底請填 **服務根網址**（不含 `/api`）。
 * 若誤設成 `http://localhost:8000/api`，會造成 `/api/api/events` → 404，這裡會自動去掉尾端 `/api`。
 */
function normalizeApiBase(raw: string): string {
  let b = raw.trim().replace(/\/+$/, '');
  if (b.toLowerCase().endsWith('/api')) {
    b = b.slice(0, -4).replace(/\/+$/, '');
  }
  return b;
}

const API_BASE = normalizeApiBase((import.meta.env.VITE_API_URL as string | undefined) ?? '');

export type DemoAccount = { id: string; label: string; roles: Role[]; userId: string };

/**
 * `/api/demo-accounts` 未載入時的預設選項（下拉仍可切）。
 * **userId 必須與後端 `app/seeding/ids.py`、`PortalService.demo_accounts` 的 UUID 一致。**
 */
export const demoAccountsFallbackSeeded: DemoAccount[] = [
  {
    id: 'employee',
    label: 'Employee Demo',
    roles: ['employee'],
    userId: 'b0000001-0000-4000-8000-000000000001',
  },
  {
    id: 'supervisor',
    label: 'Supervisor Demo',
    roles: ['supervisor'],
    userId: 'b0000001-0000-4000-8000-000000000002',
  },
  {
    id: 'admin',
    label: 'Admin Demo',
    roles: ['admin'],
    userId: 'b0000001-0000-4000-8000-000000000004',
  },
  {
    id: 'multi',
    label: 'Multi-role Demo',
    roles: ['employee', 'supervisor', 'admin'],
    userId: 'b0000001-0000-4000-8000-000000000002',
  },
];

/** JWT（記憶體）；POST /api/reports、/api/events 等須 Bearer，見後端 `get_current_user`。 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}

/** 空字串 = 與目前網頁同源（Vite `server.proxy` 或 nginx 的 `/api` 轉發）。有值 = 直連後端，例如 `http://localhost:8000`。 */
function requestUrl(path: string): string {
  if (API_BASE === '') {
    return path;
  }
  return `${API_BASE}${path}`;
}

/** 將非 2xx body 提成可讀訊息（含閘道 404 `{ message, code }` 與 FastAPI `{ detail }`）。 */
function errorFromFailBody(status: number, body: string): Error {
  const t = body.trim();
  try {
    const j = JSON.parse(t) as { detail?: unknown; message?: unknown; code?: unknown };
    if (typeof j.detail === 'string') return new Error(j.detail);
    if (Array.isArray(j.detail)) return new Error(JSON.stringify(j.detail));
    if (typeof j.message === 'string') {
      const c = typeof j.code === 'number' ? j.code : status;
      return new Error(
        `API 回覆 ${c}：${j.message}。請確認請求走的是 CNAD FastAPI（常見：` +
          '8000 被別專案占用時請在 frontend/.env.local 設 CNAD_API_PROXY_TARGET=你的 uvicorn 埠，並重啟 npm run dev）',
      );
    }
  } catch {
    /* 非 JSON */
  }
  return new Error(t || String(status));
}

async function apiFetch<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const { timeoutMs, ...restInit } = init ?? {};
  const res = await fetchWithTimeout(requestUrl(path), {
    ...restInit,
    headers,
    timeoutMs: timeoutMs ?? 25_000,
  });
  const text = await res.text();
  if (!res.ok) {
    throw errorFromFailBody(res.status, text);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export async function getDemoAccounts(): Promise<DemoAccount[]> {
  const data = await apiFetch<{ accounts: DemoAccount[] }>('/api/demo-accounts');
  return data.accounts;
}

export async function getDepartments(): Promise<Department[]> {
  const data = await apiFetch<{ departments: Department[] }>('/api/departments');
  return data.departments;
}

export async function getUsers(): Promise<User[]> {
  const data = await apiFetch<{ users: User[] }>('/api/users');
  return data.users;
}

export async function getEvents(): Promise<EventItem[]> {
  const data = await apiFetch<{ events: EventItem[] }>('/api/events');
  return data.events;
}

export async function getReports(): Promise<SafetyResponse[]> {
  const data = await apiFetch<{ reports: SafetyResponse[] }>('/api/reports');
  return data.reports;
}

export async function createEventApi(
  actorUserId: string,
  body: {
    title: string;
    type: EventItem['type'];
    description: string;
    startAt: string;
    targetDepartmentIds: string[];
  },
): Promise<{ message: string; event: EventItem }> {
  return apiFetch('/api/events', {
    method: 'POST',
    headers: { 'X-User-Id': actorUserId },
    body: JSON.stringify({
      title: body.title,
      type: body.type,
      description: body.description,
      startAt: body.startAt,
      targetDepartmentIds: body.targetDepartmentIds,
    }),
  });
}

export async function activateEventApi(actorUserId: string, eventId: string): Promise<{ message: string; event: EventItem }> {
  return apiFetch(`/api/events/${encodeURIComponent(eventId)}/activate`, {
    method: 'POST',
    headers: { 'X-User-Id': actorUserId },
    body: JSON.stringify({}),
  });
}

export async function closeEventApi(actorUserId: string, eventId: string): Promise<{ message: string; event: EventItem }> {
  return apiFetch(`/api/events/${encodeURIComponent(eventId)}/close`, {
    method: 'POST',
    headers: { 'X-User-Id': actorUserId },
  });
}

export async function registerApi(body: {
  name: string;
  email: string;
  password: string;
  departmentId?: string;
  phone?: string;
  employeeNo?: string;
}): Promise<{ message: string; user: User }> {
  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function loginWithEmailApi(body: {
  email: string;
  password: string;
}): Promise<{ user: User; access_token: string; token_type: string }> {
  clearAccessToken();
  const data = await apiFetch<{ user: User; access_token: string; token_type: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  setAccessToken(data.access_token);
  return data;
}

/** Demo 下拉登入後取得 JWT，否則受保護的 POST（如 /api/reports）會 401/403 Not authenticated */
export async function loginDemoUserApi(userId: string): Promise<{ user: User; access_token: string; token_type: string }> {
  clearAccessToken();
  const data = await apiFetch<{ user: User; access_token: string; token_type: string }>('/api/auth/demo-login', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
  setAccessToken(data.access_token);
  return data;
}
export async function submitReportApi(payload: {
  eventId: string;
  userId: string;
  status: 'safe' | 'need_help';
  location?: string;
  comment?: string;
}): Promise<{ status: string; message: string; data: SafetyResponse }> {
  return withRetries(
    async () =>
      apiFetch<{ status: string; message: string; data: SafetyResponse }>('/api/reports', {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: 35_000,
      }),
    {
      attempts: 3,
      delayMs: 700,
      shouldRetry: isProbablyTransientNetworkError,
    },
  );
}

export async function getSupervisorDashboardApi(eventId?: string): Promise<SupervisorDashboardApi> {
  const q =
    eventId && eventId.trim() !== ''
      ? `?event_id=${encodeURIComponent(eventId.trim())}`
      : '';
  return apiFetch<SupervisorDashboardApi>(`/api/dashboard/supervisor${q}`);
}

export async function getAdminDashboardApi(eventId?: string): Promise<AdminDashboardApi> {
  const q =
    eventId && eventId.trim() !== ''
      ? `?event_id=${encodeURIComponent(eventId.trim())}`
      : '';
  return apiFetch<AdminDashboardApi>(`/api/dashboard/admin${q}`);
}

export async function getMyNotificationsApi(): Promise<{ notifications: PortalNotificationRow[] }> {
  return apiFetch('/api/notifications/me');
}

export async function sendEventRemindersApi(eventId: string): Promise<{
  message: string;
  sent: number;
  already_safe: number;
  total_team: number;
}> {
  return apiFetch(`/api/events/${encodeURIComponent(eventId)}/reminders`, {
    method: 'POST',
  });
}

export async function getFailedNotificationsForEventApi(eventId: string): Promise<{ rows: FailedNotificationRow[] }> {
  return apiFetch(`/api/events/${encodeURIComponent(eventId)}/notifications/failed`);
}

export async function retryFailedNotificationApi(notificationId: string): Promise<{ notification: PortalNotificationRow }> {
  return apiFetch(`/api/notifications/${encodeURIComponent(notificationId)}/retry`, {
    method: 'POST',
  });
}
